package com.politikapp.backend.auth.repository;

import com.politikapp.backend.auth.entity.AuthUser;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AuthUserRepository extends JpaRepository<AuthUser, UUID> {
    @Query("select u from AuthUser u where lower(u.email) = lower(?1)")
    Optional<AuthUser> findByEmailIgnoreCase(String email);

    @Query("select u from AuthUser u where lower(u.username) = lower(?1)")
    Optional<AuthUser> findByUsernameIgnoreCase(String username);
}
