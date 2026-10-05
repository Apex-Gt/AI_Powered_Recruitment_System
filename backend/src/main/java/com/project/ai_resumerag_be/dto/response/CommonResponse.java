    package com.project.ai_resumerag_be.dto.response;


    import com.fasterxml.jackson.annotation.JsonFormat;
    import com.project.ai_resumerag_be.enumerators.CommonResponseStatus;
    import lombok.AllArgsConstructor;
    import lombok.Builder;
    import lombok.Data;
    import lombok.NoArgsConstructor;

    import java.time.LocalDateTime;

    @Builder
    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public class CommonResponse {
        private int code;
        private CommonResponseStatus status;
        private Object data;
        private String message;
        @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
        private LocalDateTime timestamp;
    }
