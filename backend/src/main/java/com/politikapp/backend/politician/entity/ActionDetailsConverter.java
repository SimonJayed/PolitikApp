package com.politikapp.backend.politician.entity;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Map;

/** Preserve stored decimal amounts in the untyped action JSON. */
@Converter
public class ActionDetailsConverter implements AttributeConverter<Map<String, Object>, String> {
    private static final JsonMapper JSON = JsonMapper.builder().findAndAddModules()
            .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS).build();
    private static final TypeReference<Map<String, Object>> DETAILS = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(Map<String, Object> details) {
        if (details == null) return null;
        try {
            return JSON.writeValueAsString(details);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Action details could not be written.", exception);
        }
    }

    @Override
    public Map<String, Object> convertToEntityAttribute(String stored) {
        if (stored == null) return null;
        try {
            return JSON.readValue(stored, DETAILS);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Action details could not be read.", exception);
        }
    }
}
