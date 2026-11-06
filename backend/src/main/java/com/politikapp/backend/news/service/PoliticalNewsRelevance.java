package com.politikapp.backend.news.service;

import java.util.Locale;
import java.util.regex.Pattern;

/** Conservative title-based gate for the politics and accountability news feed. */
public class PoliticalNewsRelevance {
    private static final Pattern GOVERNANCE = Pattern.compile(
            "\\b(?:senate|senador|senado|congress|kongreso|house bill|house committee|house of representatives|"
            + "legislation|legislative|lawmakers?|bicam|impeachment|supreme court|constitutional|"
            + "executive order|administrative order|memorandum circular|republic act|"
            + "national budget|budget|badyet|appropriations?|unprogrammed funds?|"
            + "public funds?|government funds?|gov(?:ernmen)?t spending|wasteful spending|"
            + "procurement|audit|accountability|corruption|confidential funds?|"
            + "government policy|public policy|policy reform|procurement reform|"
            + "funding|fund allocation|fund releases?|allocation of funds?)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern EXECUTIVE_ACTION = Pattern.compile(
            "\\b(?:president|presidential|marcos|pbbm|pangulo|palace|palasyo|malacañang|malacanang)\\b"
            + ".{0,75}\\b(?:orders?|directs?|announces?|declares?|signs?|approves?|vetoes?|"
            + "instructs?|mandates?|iniutos|inatasan|inanunsyo|nilagdaan|inaprubahan)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern NATIONAL_SPENDING = Pattern.compile(
            "\\b(?:p(?:hp)?\\s?\\d+(?:\\.\\d+)?[-\\s]?(?:billion|million|trillion|b|m|t)|"
            + "₱\\s?\\d+(?:\\.\\d+)?[-\\s]?(?:billion|million|trillion|b|m|t))\\b"
            + ".{0,100}\\b(?:national|government|gov(?:ernmen)?t|public|project|program|"
            + "infrastructure|budget|badyet|fund)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    public boolean relevant(String title) {
        if (title == null || title.isBlank()) return false;
        String normalized = title.replace('\u2019', '\'').trim().toLowerCase(Locale.ROOT);
        // A number alone cannot establish the subject or national significance of a proclamation.
        if (normalized.matches("proclamation no\\.?\\s*\\d+.*")) return false;
        if (normalized.matches(".*\\b(?:special non-working day|local holiday)\\b.*")) return false;
        return GOVERNANCE.matcher(normalized).find()
                || EXECUTIVE_ACTION.matcher(normalized).find()
                || NATIONAL_SPENDING.matcher(normalized).find();
    }
}
