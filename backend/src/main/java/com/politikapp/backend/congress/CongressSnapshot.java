package com.politikapp.backend.congress;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/** Reads Git objects, not mutable working-tree files. Never executes upstream scripts or hooks. */
final class CongressSnapshot implements AutoCloseable {
    static final String REPOSITORY = "https://github.com/bettergovph/open-congress-data";
    record File(String path, String blob) {}

    final String commit;
    final Instant updatedAt;
    final Map<String, File> files = new LinkedHashMap<>();
    private final Path root;
    private final Process reader;
    private final BufferedInputStream output;

    CongressSnapshot(String checkout, String commit) throws IOException, InterruptedException {
        if (checkout == null || checkout.isBlank()) throw new IOException("OPEN_CONGRESS_CHECKOUT is not configured.");
        if (commit == null || !commit.matches("[0-9a-f]{40}")) throw new IOException("A full lowercase Git commit SHA is required.");
        this.root = Path.of(checkout).toRealPath();
        if (!Files.isDirectory(root)) throw new IOException("Dataset checkout is not a directory.");
        String origin = command("config", "--get", "remote.origin.url").trim();
        if (!List.of(REPOSITORY, REPOSITORY + ".git", "git@github.com:bettergovph/open-congress-data.git").contains(origin)) {
            throw new IOException("Checkout origin must be bettergovph/open-congress-data.");
        }
        this.commit = command("rev-parse", "--verify", commit + "^{commit}").trim();
        if (!this.commit.equals(commit)) throw new IOException("Commit did not resolve exactly.");
        this.updatedAt = Instant.parse(command("show", "-s", "--format=%cI", commit).trim());
        for (String line : command("ls-tree", "-r", commit, "--", "data").split("\n")) {
            if (line.isBlank()) continue;
            String[] parts = line.split("\t", 2);
            if (parts.length != 2) throw new IOException("Unsupported Git path.");
            String[] header = parts[0].split(" ");
            String path = parts[1];
            if (!path.matches("data/[A-Za-z0-9_./-]+")) throw new IOException("Unsupported dataset path.");
            if (!"100644".equals(header[0]) && !"100755".equals(header[0])) throw new IOException("Dataset symlinks/submodules are not supported.");
            files.put(path, new File(path, header[2]));
        }
        for (String prefix : List.of("data/person/", "data/congress/", "data/group/chamber/", "data/document/")) {
            if (files.keySet().stream().noneMatch(p -> p.startsWith(prefix) && p.endsWith(".toml"))) {
                throw new IOException("Required dataset directory missing: " + prefix);
            }
        }
        reader = process("cat-file", "--batch").start();
        output = new BufferedInputStream(reader.getInputStream());
    }

    byte[] read(File file) throws IOException {
        reader.getOutputStream().write((file.blob() + "\n").getBytes(StandardCharsets.US_ASCII));
        reader.getOutputStream().flush();
        StringBuilder header = new StringBuilder();
        for (int c; (c = output.read()) != '\n';) {
            if (c < 0 || header.length() > 200) throw new IOException("Git object reader failed.");
            header.append((char) c);
        }
        String[] fields = header.toString().split(" ");
        if (fields.length != 3 || !fields[0].equals(file.blob()) || !fields[1].equals("blob")) throw new IOException("Missing Git blob.");
        int size = Integer.parseInt(fields[2]);
        if (size < 0 || size > 8 * 1024 * 1024) throw new IOException("Dataset file exceeds 8 MiB limit.");
        byte[] bytes = output.readNBytes(size);
        if (bytes.length != size || output.read() != '\n') throw new IOException("Truncated Git object.");
        return bytes;
    }

    private ProcessBuilder process(String... arguments) {
        List<String> command = new ArrayList<>(List.of("git", "-c", "safe.directory=" + root,
                "-c", "core.hooksPath=/dev/null", "--no-pager", "-C", root.toString()));
        command.addAll(List.of(arguments));
        return new ProcessBuilder(command).redirectError(ProcessBuilder.Redirect.DISCARD);
    }

    private String command(String... arguments) throws IOException, InterruptedException {
        return new String(commandBytes(root, arguments), StandardCharsets.UTF_8);
    }

    static String head(String checkout) throws IOException, InterruptedException {
        if (checkout == null || checkout.isBlank()) throw new IOException("Dataset checkout is not configured.");
        String sha = new String(commandBytes(Path.of(checkout).toRealPath(), "rev-parse", "HEAD"), StandardCharsets.UTF_8).trim();
        if (!sha.matches("[0-9a-f]{40}")) throw new IOException("Cannot resolve dataset commit.");
        return sha;
    }

    static byte[] readBlob(String checkout, String blob) throws IOException, InterruptedException {
        if (!blob.matches("[0-9a-f]{40}")) throw new IOException("Invalid blob ID.");
        return commandBytes(Path.of(checkout).toRealPath(), "cat-file", "blob", blob);
    }

    private static byte[] commandBytes(Path root, String... arguments) throws IOException, InterruptedException {
        List<String> command = new ArrayList<>(List.of("git", "-c", "safe.directory=" + root,
                "--no-pager", "-C", root.toString()));
        command.addAll(List.of(arguments));
        Process process = new ProcessBuilder(command).redirectError(ProcessBuilder.Redirect.DISCARD).start();
        try {
            // Local Git operations only. Bound both output and execution time.
            var result = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                try { return process.getInputStream().readNBytes(32 * 1024 * 1024 + 1); }
                catch (IOException e) { throw new java.io.UncheckedIOException(e); }
            });
            if (!process.waitFor(60, TimeUnit.SECONDS)) throw new IOException("Git command timed out.");
            byte[] bytes;
            try { bytes = result.get(5, TimeUnit.SECONDS); }
            catch (java.util.concurrent.ExecutionException | java.util.concurrent.TimeoutException e) { throw new IOException("Cannot read Git output.", e); }
            if (process.exitValue() != 0 || bytes.length > 32 * 1024 * 1024) throw new IOException("Git command failed or dataset tree is too large.");
            return bytes;
        } finally { process.destroyForcibly(); }
    }

    @Override public void close() throws IOException {
        reader.destroyForcibly();
        output.close();
    }
}
