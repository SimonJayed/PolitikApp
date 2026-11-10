package com.politikapp.backend.congress;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Explicit development command. No web-server startup or automatic production import. */
public final class CongressPopulationCommand {
    public static void main(String[] args) throws Exception {
        boolean apply=Arrays.asList(args).contains("--apply");
        if (apply && !Arrays.asList(args).contains("--development")) throw new IllegalArgumentException("Apply requires --development.");
        var settings=new Properties();
        try(var reader=Files.newBufferedReader(Path.of(".env"))) { settings.load(reader); }
        try (var ds=new com.zaxxer.hikari.HikariDataSource()) {
        ds.setJdbcUrl(unquote(settings.getProperty("DATABASE_URL")));
        ds.setUsername(unquote(settings.getProperty("DATABASE_USERNAME")));
        ds.setPassword(unquote(settings.getProperty("DATABASE_PASSWORD")));
        ds.setMaximumPoolSize(2);
        ds.setMinimumIdle(1);
        var jdbc=new JdbcTemplate(ds);
        var json=new ObjectMapper();
        var transactions=new DataSourceTransactionManager(ds);
        var store=new CongressStore(jdbc,json,transactions);
        store.requireSchema();
        String checkout=unquote(settings.getProperty("OPEN_CONGRESS_CHECKOUT"));
        String commit=CongressSnapshot.head(checkout);
        Path reports=Path.of("target","congress-population");
        Files.createDirectories(reports);
        String stamp=java.time.Instant.now().toString().replace(":", "-");
        // Back up every existing profile and identity link before any schema or data write.
        var backup=new LinkedHashMap<String,Object>();
        backup.put("commit",commit);
        backup.put("profiles",jdbc.queryForList("select row_to_json(p)::text as record from public.politicians p order by politician_id"));
        backup.put("identityLinks",jdbc.queryForList("select row_to_json(e)::text as record from public.open_congress_entities e where kind='PERSON' order by id"));
        json.writerWithDefaultPrettyPrinter().writeValue(reports.resolve(stamp+"-before.json").toFile(),backup);
        var population=new CongressPopulationService(jdbc,json);
        var profilePreview=population.preview(commit);
        json.writerWithDefaultPrettyPrinter().writeValue(reports.resolve(stamp+"-profile-preview.json").toFile(),profilePreview);
        Map<String,Object> sourcePreview=synchronize(store,checkout,commit,false);
        json.writerWithDefaultPrettyPrinter().writeValue(reports.resolve(stamp+"-source-preview.json").toFile(),sourcePreview);
        System.out.println("SOURCE_PREVIEW "+json.writeValueAsString(sourcePreview));
        System.out.println("PROFILE_PREVIEW people="+profilePreview.people()+" create="+profilePreview.created()
                +" linkExisting="+profilePreview.existingLinked()+" alreadyLinked="+profilePreview.alreadyLinked()+" skipped="+profilePreview.skipped());
        if (!apply) return;
        // V26 only relaxes missing-field constraints and adds provenance/audit metadata.
        var flyway=Flyway.configure().dataSource(ds).locations("classpath:db/migration")
                .defaultSchema("public").target("26").cleanDisabled(true).load();
        flyway.migrate();
        Map<String,Object> sourceResult=synchronize(store,checkout,commit,true);
        json.writerWithDefaultPrettyPrinter().writeValue(reports.resolve(stamp+"-source-result.json").toFile(),sourceResult);
        var result=new TransactionTemplate(transactions).execute(status -> population.populate(commit));
        json.writerWithDefaultPrettyPrinter().writeValue(reports.resolve(stamp+"-profile-result.json").toFile(),result);
        // No pre-existing profile field may change, including curated status and term dates.
        var after=jdbc.queryForList("select row_to_json(p)::text as record from public.politicians p order by politician_id");
        var current=new HashSet<>(after.stream().map(row -> row.get("record")).toList());
        for (var previous : (List<Map<String,Object>>)backup.get("profiles")) {
            if (!current.contains(previous.get("record"))) {
                // V26's new provenance default is expected; compare original fields only.
                var old=json.readTree(previous.get("record").toString());
                boolean retained=false;
                for (var row : after) {
                    var now=json.readTree(row.get("record").toString());
                    if (old.path("politician_id").equals(now.path("politician_id"))) {
                        ((com.fasterxml.jackson.databind.node.ObjectNode)now).remove("profile_origin");
                        var prior=old.deepCopy(); ((com.fasterxml.jackson.databind.node.ObjectNode)prior).remove("profile_origin");
                        retained=prior.equals(now); break;
                    }
                }
                if (!retained) throw new IllegalStateException("Existing profile changed unexpectedly; inspect the before backup.");
            }
        }
        System.out.println("SOURCE_RESULT "+json.writeValueAsString(sourceResult));
        System.out.println("POPULATED people="+result.people()+" created="+result.created()+" existingLinked="+result.existingLinked()
                +" alreadyLinked="+result.alreadyLinked()+" skipped="+result.skipped()+" memberships="+result.memberships()+" billRelationships="+result.billRelationships());
        System.out.println("REPORT_DIRECTORY "+reports.toAbsolutePath());
        }
    }

    static Map<String,Object> synchronize(CongressStore store,String checkout,String commit,boolean apply) throws Exception {
        var counts=new TreeMap<String,Integer>();
        var issues=new ArrayList<Map<String,String>>();
        var index=store.previewIndex();
        var billKeys=new HashMap<CongressStore.BillKey,String>();
        var order=List.of("CONGRESS","CHAMBER","COMMITTEE","PERSON","BILL");
        try(var snapshot=new CongressSnapshot(checkout,commit)) {
            var parser=new CongressDatasetParser(snapshot);
            var files=snapshot.files.values().stream().filter(f -> CongressDatasetParser.kind(f)!=null)
                    .sorted(Comparator.comparingInt((CongressSnapshot.File f) -> order.indexOf(CongressDatasetParser.kind(f)))
                            .thenComparing(CongressSnapshot.File::path)).toList();
            var batch=new ArrayList<CongressStore.BatchItem>();
            String previousKind=null;
            int processed=0;
            for (var file : files) {
                String kind=CongressDatasetParser.kind(file);
                if (!batch.isEmpty() && (!kind.equals(previousKind) || batch.size()>=1000)) {
                    store.createBatch(batch,snapshot); batch.clear();
                }
                previousKind=kind;
                counts.merge(kind,1,Integer::sum);
                String id=CongressDatasetParser.fileId(file);
                var existing=index.entities().get(id);
                if (existing!=null && parser.revision(file).equals(existing.revision())) counts.merge("UNCHANGED",1,Integer::sum);
                else {
                    try {
                        var parsed=parser.parse(file);
                        String assessment=store.assessPreview(parsed,snapshot,index);
                        if ("BILL".equals(kind) && parsed.billNumber()!=null) {
                            var key=new CongressStore.BillKey(parsed.congress(),parsed.subtype(),parsed.billNumber());
                            String other=billKeys.putIfAbsent(key,id);
                            if (other!=null && !other.equals(id)) assessment="DUPLICATE_BILL_IDENTITY";
                        }
                        if ("WOULD_CREATE".equals(assessment)) {
                            if (apply) batch.add(new CongressStore.BatchItem(parsed,file));
                            counts.merge(apply?"CREATED":"WOULD_CREATE",1,Integer::sum);
                        } else {
                            counts.merge(assessment,1,Integer::sum);
                            issues.add(Map.of("path",file.path(),"reason",assessment));
                        }
                    } catch (java.io.IOException error) {
                        counts.merge("INVALID_SOURCE",1,Integer::sum);
                        issues.add(Map.of("path",file.path(),"reason",error.getMessage()));
                    }
                }
                if (++processed%5000==0) System.out.println("SOURCE_PROGRESS "+(apply?"apply":"preview")+" "+processed+"/"+files.size());
            }
            if (!batch.isEmpty()) store.createBatch(batch,snapshot);
            counts.put("TOTAL",files.size());
        }
        return Map.of("commit",commit,"dryRun",!apply,"counts",counts,"issues",issues);
    }

    private static String unquote(String value) {
        if (value==null) return "";
        String text=value.trim();
        if(text.length()>1 && ((text.startsWith("\"")&&text.endsWith("\"")) || (text.startsWith("'")&&text.endsWith("'")))) return text.substring(1,text.length()-1);
        return text;
    }
}
