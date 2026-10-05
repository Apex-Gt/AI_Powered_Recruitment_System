package com.project.ai_resumerag_be.exception;


import com.project.ai_resumerag_be.dto.response.CommonResponse;
import com.project.ai_resumerag_be.enumerators.CommonResponseStatus;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AccountExpiredException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;


@RestControllerAdvice
public class GlobalExceptionHandler {

    private ResponseEntity<CommonResponse> buildResponse(
            HttpStatus status,
            String message,
            Object data
    ) {

        CommonResponse response = CommonResponse.builder()
                .code(status.value())
                .status(CommonResponseStatus.FAILURE)
                .message(message)
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();

        return ResponseEntity.status(status).body(response);
    }


    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<CommonResponse> handleValidationException(
            MethodArgumentNotValidException ex
    ) {

        Map<String, String> errors = new LinkedHashMap<>();

        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.put(error.getField(), error.getDefaultMessage());
        }

        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "Validation failed.",
                errors
        );
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<CommonResponse> handleHandlerValidation(
            HandlerMethodValidationException ex
    ) {

        return buildResponse(
                HttpStatus.BAD_REQUEST,
                "Validation failed.",
                null
        );
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<CommonResponse> handleConstraintViolation(
            ConstraintViolationException ex
    ) {

        return buildResponse(
                HttpStatus.BAD_REQUEST,
                ex.getMessage(),
                null
        );
    }


    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<CommonResponse> handleBadRequest(
            BadRequestException ex
    ) {

        return buildResponse(
                HttpStatus.BAD_REQUEST,
                ex.getMessage(),
                null
        );
    }


    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<CommonResponse> handleNotFound(
            ResourceNotFoundException ex
    ) {

        return buildResponse(
                HttpStatus.NOT_FOUND,
                ex.getMessage(),
                null
        );
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<CommonResponse> handleConflict(
            ConflictException ex
    ) {

        return buildResponse(
                HttpStatus.CONFLICT,
                ex.getMessage(),
                null
        );
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<CommonResponse> handleDatabaseException(
            DataIntegrityViolationException ex
    ) {

        Throwable rootCause = ex;

        while (rootCause.getCause() != null) {
            rootCause = rootCause.getCause();
        }

        return buildResponse(
                HttpStatus.CONFLICT,
                rootCause.getMessage(),
                null
        );
    }


    @ExceptionHandler(ErrorResponseException.class)
    public ResponseEntity<CommonResponse> handleSpringException(
            ErrorResponseException ex
    ) {

        return buildResponse(
                HttpStatus.valueOf(ex.getStatusCode().value()),
                ex.getBody().getDetail(),
                null
        );
    }

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    public ResponseEntity<CommonResponse> handleEmailAlreadyExists(
            EmailAlreadyRegisteredException ex
    ) {

        return buildResponse(
                HttpStatus.CONFLICT,
                ex.getMessage(),
                null
        );
    }
    @ExceptionHandler(PhoneNumberAlreadyExistsException.class)
    public ResponseEntity<CommonResponse> handlePhoneNumberAlreadyExists(
            PhoneNumberAlreadyExistsException ex
    ) {

        return buildResponse(
                HttpStatus.CONFLICT,
                ex.getMessage(),
                null
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<CommonResponse> handleAccessDenied(
            AccessDeniedException ex
    ) {

        return buildResponse(
                HttpStatus.FORBIDDEN,
                "Access denied: " + ex.getMessage(),
                null
        );
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<CommonResponse> handleBadCredentials(
            BadCredentialsException ex
    ) {

        return buildResponse(
                HttpStatus.UNAUTHORIZED,
                "Invalid email or password",
                null
        );
    }

    @ExceptionHandler(UsernameNotFoundException.class)
    public ResponseEntity<CommonResponse> handleUserNotFound(
            UsernameNotFoundException ex
    ) {

        return buildResponse(
                HttpStatus.UNAUTHORIZED,
                "Invalid email or password",
                null
        );
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<CommonResponse> handleDisabled(
            DisabledException ex
    ) {

        return buildResponse(
                HttpStatus.UNAUTHORIZED,
                "Account is disabled. Please contact administrator.",
                null
        );
    }

    @ExceptionHandler(LockedException.class)
    public ResponseEntity<CommonResponse> handleLocked(
            LockedException ex
    ) {

        return buildResponse(
                HttpStatus.UNAUTHORIZED,
                "Account is locked. Please contact administrator.",
                null
        );
    }

    @ExceptionHandler(AccountExpiredException.class)
    public ResponseEntity<CommonResponse> handleAccountExpired(
            AccountExpiredException ex
    ) {

        return buildResponse(
                HttpStatus.UNAUTHORIZED,
                "Account has expired. Please contact administrator.",
                null
        );
    }

    @ExceptionHandler(CredentialsExpiredException.class)
    public ResponseEntity<CommonResponse> handleCredentialsExpired(
            CredentialsExpiredException ex
    ) {

        return buildResponse(
                HttpStatus.UNAUTHORIZED,
                "Credentials have expired. Please reset your password.",
                null
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<CommonResponse> handleException(Exception ex) {

        ex.printStackTrace();

        return buildResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                ex.getMessage(),
                null
        );
    }

}