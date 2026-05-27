package com.politikapp.backend.common;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Collections;
import java.util.Map;

@Converter
public class JsonToMapConverter implements AttributeConverter<Map<String, Object>, String> {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(Map<String, Object> attribute) {
        try {
            return OBJECT_MAPPER.writeValueAsString(attribute == null ? Collections.emptyMap() : attribute);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Unable to serialize action details.", exception);
        }
    }

    @Override
    public Map<String, Object> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return Collections.emptyMap();
        }
        try {
            return OBJECT_MAPPER.readValue(dbData, MAP_TYPE);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Unable to deserialize action details.", exception);
        }
    }
}
