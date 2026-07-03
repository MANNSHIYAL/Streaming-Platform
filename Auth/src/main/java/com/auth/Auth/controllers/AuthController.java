package com.auth.Auth.controllers;

import java.util.Map;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.auth.Auth.models.User;
import com.auth.Auth.repository.UserRepository;
import com.auth.Auth.security.JwtTokenProvider;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final JwtTokenProvider tokenProvider;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AuthController(UserRepository userRepository, JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.tokenProvider = tokenProvider;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        User savedUser = userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "User created", "id", savedUser.getId()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String userName = credentials.get("user");
        String email = credentials.get("user");
        String password = credentials.get("password");

        Optional<User> userOpt = userRepository.findByUsernameOrEmail(userName,email);

        if (userOpt.isPresent() && passwordEncoder.matches(password, userOpt.get().getPassword())) {
            User user = userOpt.get();
            String token = tokenProvider.generateToken(user.getUsername(), user.getRole());
            return ResponseEntity.ok(Map.of("id", user.getId(),"token", token));
        }
        return ResponseEntity.status(401).body("Invalid username or password");
    }

    @GetMapping("/valid-session")
    public ResponseEntity<Void> isSessionValid(){
        return ResponseEntity.ok().build();
    }
}
