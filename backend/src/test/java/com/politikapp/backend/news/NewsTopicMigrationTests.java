package com.politikapp.backend.news;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.sql.DriverManager;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import db.migration.V28__index_automatic_news_topics;

class NewsTopicMigrationTests {
    @Test
    void backfillsExistingArticlesAcrossBatchesAndCreatesTopicIndex() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:topic_migration;MODE=PostgreSQL")) {
            try (var sql = connection.createStatement()) {
                sql.execute("CREATE TABLE news_articles (id INT PRIMARY KEY, original_title TEXT, suggested_title TEXT, ai_summary TEXT, original_content TEXT, status VARCHAR(40), published_at TIMESTAMP)");
                sql.execute("INSERT INTO news_articles (id, original_title) SELECT x, 'Senate files bill for public services' FROM SYSTEM_RANGE(1, 205)");
            }
            var context = mock(Context.class);
            when(context.getConnection()).thenReturn(connection);
            new V28__index_automatic_news_topics().migrate(context);
            try (var sql = connection.createStatement();
                 var rows = sql.executeQuery("SELECT COUNT(*) FROM news_articles WHERE automatic_topic = 'Legislation'")) {
                assertTrue(rows.next());
                assertEquals(205, rows.getInt(1));
            }
            try (var indexes = connection.getMetaData().getIndexInfo(null, null, "NEWS_ARTICLES", false, false)) {
                boolean found = false;
                while (indexes.next()) found |= "IDX_NEWS_PUBLIC_TOPIC_DATE".equals(indexes.getString("INDEX_NAME"));
                assertTrue(found);
            }
        }
    }
}
