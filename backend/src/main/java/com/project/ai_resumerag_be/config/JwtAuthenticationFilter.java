package com.project.ai_resumerag_be.config;

import com.project.ai_resumerag_be.service.security.CustomUserDetailsService;
import com.project.ai_resumerag_be.service.security.JwtService;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final CustomUserDetailsService customUserDetailsService;

    // Controllers returning Mono/DeferredResult complete in an ASYNC dispatch. The session is stateless, so the
    // security context is gone by then; the JWT must be re-read or the finished response is rejected with 401.
    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return false;
    }

    @Override
    protected boolean shouldNotFilterErrorDispatch() {
        return false;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {


        String path = request.getServletPath();

        // Only the public credential endpoints bypass JWT processing. /auth/me, /auth/logout etc.
        // must go through the filter so the cookie is validated and the user is authenticated.
        if (path.equals("/auth/login")) {
            filterChain.doFilter(request, response);
            return;
        }


        String jwt = getJwtFromCookies(request);

        if (jwt != null) {
            try {
                String email = jwtService.extractUsername(jwt);

                if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                    UserDetails userDetails = customUserDetailsService.loadUserByUsername(email);

                    if (jwtService.isTokenValid(jwt, userDetails)) {

                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(
                                        userDetails,
                                        null,
                                        userDetails.getAuthorities()
                                );

                        authentication.setDetails(
                                new WebAuthenticationDetailsSource().buildDetails(request)
                        );

                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                }
            } catch (JwtException | IllegalArgumentException | UsernameNotFoundException ex) {
                // Expired, malformed, tampered or orphaned token: leave the request unauthenticated
                // so the entry point answers 401.
                SecurityContextHolder.clearContext();
                logger.debug("Rejected JWT cookie: " + ex.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }

    private String getJwtFromCookies(HttpServletRequest request) {

        Cookie[] cookies = request.getCookies();

        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {

            if ("jwt".equals(cookie.getName())) {
                return cookie.getValue();
            }

        }

        return null;
    }
}