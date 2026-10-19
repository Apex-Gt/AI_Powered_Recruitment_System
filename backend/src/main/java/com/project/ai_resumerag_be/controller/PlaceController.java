package com.project.ai_resumerag_be.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Country / state / city suggestions, proxied through Geoapify so the API key stays on the server. */
@Slf4j
@RestController
@RequestMapping("/places")
public class PlaceController {

    public record PlaceSuggestion(String label, String name, String countryCode, String placeId) {}

    private static final Set<String> TYPES = Set.of("country", "state", "city");

    private final WebClient geoapify = WebClient.builder().baseUrl("https://api.geoapify.com").build();

    @Value("${geoapify.api-key:}")
    private String apiKey;

    /**
     * @param type        country, state or city
     * @param countryCode optional ISO code (e.g. "in") to keep results inside one country
     * @param stateId     optional place id of a state/country to keep results inside it (wins over countryCode)
     */
    @GetMapping("/search")
    public ResponseEntity<List<PlaceSuggestion>> search(@RequestParam("q") String query,
                                                        @RequestParam("type") String type,
                                                        @RequestParam(value = "countryCode", required = false) String countryCode,
                                                        @RequestParam(value = "stateId", required = false) String stateId) {
        String text = query == null ? "" : query.trim();
        if (!TYPES.contains(type) || text.length() < 2) {
            return ResponseEntity.ok(List.of());
        }
        if (apiKey.isBlank()) {
            log.warn("Place search unavailable: geoapify.api-key is empty (is GEOAPIFY_API_KEY set in backend/.env?)");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }

        try {
            JsonNode body = geoapify.get()
                    .uri(u -> {
                        var b = u.path("/v1/geocode/autocomplete")
                                .queryParam("text", text)
                                .queryParam("type", type)
                                .queryParam("format", "json")
                                .queryParam("limit", 10)
                                .queryParam("apiKey", apiKey);
                        if (stateId != null && !stateId.isBlank()) {
                            b.queryParam("filter", "place:" + stateId);
                        } else if (countryCode != null && !countryCode.isBlank()) {
                            b.queryParam("filter", "countrycode:" + countryCode.toLowerCase());
                        }
                        return b.build();
                    })
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block(Duration.ofSeconds(5));

            Map<String, PlaceSuggestion> out = new LinkedHashMap<>();
            if (body != null && body.has("results")) {
                for (JsonNode r : body.get("results")) {
                    String country = r.path("country").asString("");
                    String state = r.path("state").asString("");
                    String city = r.path("city").asString("");
                    String name = switch (type) {
                        case "country" -> country;
                        case "state" -> state;
                        default -> city;
                    };
                    if (name.isBlank()) {
                        continue;
                    }
                    StringBuilder label = new StringBuilder(name);
                    if (!type.equals("state") && !state.isBlank() && !state.equals(name)) label.append(", ").append(state);
                    if (!type.equals("country") && !country.isBlank()) label.append(", ").append(country);
                    out.putIfAbsent(label.toString(), new PlaceSuggestion(
                            label.toString(), name, r.path("country_code").asString(""), r.path("place_id").asString("")));
                }
            }
            return ResponseEntity.ok(List.copyOf(out.values()));
        } catch (Exception e) {
            log.warn("Geoapify place search failed for type={} q='{}': {}", type, text, e.toString());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
    }
}
