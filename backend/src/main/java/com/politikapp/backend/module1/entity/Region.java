package com.politikapp.backend.module1.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "regions")
@Getter
@Setter
@NoArgsConstructor
public class Region {
    @Id
    @Column(name = "region_id", nullable = false)
    private UUID regionId;

    @Column(name = "region_code", unique = true, length = 20)
    private String regionCode;

    @Column(name = "region_name", nullable = false, length = 150)
    private String regionName;
}
