package com.politikapp.backend.module1.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "cities_municipalities")
@Getter
@Setter
@NoArgsConstructor
public class CityMunicipality {
    @Id
    @Column(name = "city_municipality_id", nullable = false)
    private UUID cityMunicipalityId;

    @ManyToOne
    @JoinColumn(name = "province_id", nullable = false)
    private Province province;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "type", length = 50)
    private String type;
}
