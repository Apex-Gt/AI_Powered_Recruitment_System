package com.project.ai_resumerag_be.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * Authenticates server-to-server calls from the AI service. A request carrying the configured
 * {@code X-API-Key} header gets {@code ROLE_SERVICE}, which {@link SecurityConfig} requires for the
 * AI callback endpoints. Requests without a valid key are left untouched.
 */
@Component
public class ApiKeyAuthenticationFilter extends OncePerRequestFilter {

    static final String HEADER = "X-API-Key";

    private final byte[] expectedKey;

    public ApiKeyAuthenticationFilter(@Value("${ai-service.api-key:}") String apiKey) {
        this.expectedKey = apiKey.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String provided = request.getHeader(HEADER);

        if (provided != null && expectedKey.length > 0
                && MessageDigest.isEqual(expectedKey, provided.getBytes(StandardCharsets.UTF_8))) {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(
                            "ai-service", null, List.of(new SimpleGrantedAuthority("ROLE_SERVICE"))));
        }

        chain.doFilter(request, response);
    }
}
