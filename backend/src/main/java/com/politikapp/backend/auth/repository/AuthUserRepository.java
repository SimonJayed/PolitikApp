package com.politikapp.backend.auth.repository;

import com.politikapp.backend.auth.entity.AuthUser;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Query;

public interface AuthUserRepository extends JpaRepository<AuthUser, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from AuthUser u where u.userId = :id")
    java.util.Optional<AuthUser> lockById(@Param("id") java.util.UUID id);

    @Query("select u from AuthUser u where lower(u.email) = lower(?1)")
    Optional<AuthUser> findByEmailIgnoreCase(String email);

    @Query("select u from AuthUser u where lower(u.username) = lower(?1)")
    Optional<AuthUser> findByUsernameIgnoreCase(String username);
}
