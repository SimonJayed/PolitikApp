package db.migration;

import com.politikapp.backend.news.entity.NewsArticle;
import com.politikapp.backend.news.service.NewsTopics;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

public class V28__index_automatic_news_topics extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        var connection = context.getConnection();
        try (var statement = connection.createStatement()) {
            statement.execute("ALTER TABLE news_articles ADD COLUMN automatic_topic VARCHAR(80)");
        }
        try (var select = connection.prepareStatement(
                "SELECT id, original_title, suggested_title, ai_summary, substring(original_content, 1, 1500) AS lead FROM news_articles");
             var update = connection.prepareStatement("UPDATE news_articles SET automatic_topic = ? WHERE id = ?")) {
            select.setFetchSize(200);
            try (var rows = select.executeQuery()) {
                int pending = 0;
                while (rows.next()) {
                    var article = new NewsArticle();
                    article.setOriginalTitle(rows.getString("original_title"));
                    article.setSuggestedTitle(rows.getString("suggested_title"));
                    article.setAiSummary(rows.getString("ai_summary"));
                    article.setOriginalContent(rows.getString("lead"));
                    update.setString(1, NewsTopics.category(article));
                    update.setObject(2, rows.getObject("id"));
                    update.addBatch();
                    if (++pending == 200) { update.executeBatch(); pending = 0; }
                }
                if (pending > 0) update.executeBatch();
            }
        }
        try (var statement = connection.createStatement()) {
            statement.execute("ALTER TABLE news_articles ALTER COLUMN automatic_topic SET NOT NULL");
            statement.execute("CREATE INDEX idx_news_public_topic_date ON news_articles (status, automatic_topic, published_at DESC)");
        }
    }
}
