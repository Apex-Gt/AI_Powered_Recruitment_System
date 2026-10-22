package com.project.ai_resumerag_be.pipeline;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Set;

/**
 * Checks one uploaded file by its name and its first bytes. The extension a client sends is not trusted:
 * a PDF must start with %PDF-, a DOCX must be a zip, and plain text must not contain binary NUL bytes.
 */
public final class UploadValidator {

    public record Verdict(boolean ok, String code, String message) {
        static Verdict accept() {
            return new Verdict(true, null, null);
        }

        static Verdict reject(String code, String message) {
            return new Verdict(false, code, message);
        }
    }

    private UploadValidator() {
    }

    /** Strips any path a client put in the file name and bounds its length. */
    public static String safeName(String original) {
        String name = original == null || original.isBlank() ? "resume" : original;
        try {
            name = Paths.get(name.replace('\\', '/')).getFileName().toString();
        } catch (RuntimeException ignored) {
            name = "resume";
        }
        name = name.replaceAll("[\\p{Cntrl}]", "");
        return name.length() > 200 ? name.substring(name.length() - 200) : name;
    }

    public static String extension(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot < 0 ? "" : fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public static Verdict check(String fileName, long size, InputStream content, Set<String> allowed, long maxBytes) throws IOException {
        String ext = extension(fileName);
        if (!allowed.contains(ext)) {
            return Verdict.reject("UNSUPPORTED_TYPE", "Only " + String.join(", ", allowed).toUpperCase(Locale.ROOT) + " resumes are accepted");
        }
        if (size <= 0) {
            return Verdict.reject("EMPTY_FILE", "The file is empty");
        }
        if (size > maxBytes) {
            return Verdict.reject("FILE_TOO_LARGE", "The file is larger than " + (maxBytes / (1024 * 1024)) + " MB");
        }
        byte[] head = content.readNBytes(4096);
        boolean valid = switch (ext) {
            case "pdf" -> startsWith(head, new byte[]{'%', 'P', 'D', 'F', '-'});
            case "docx" -> startsWith(head, new byte[]{'P', 'K', 3, 4});
            case "txt" -> noNul(head);
            default -> false;
        };
        return valid ? Verdict.accept() : Verdict.reject("INVALID_CONTENT", "The file content does not match its ." + ext + " extension");
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private static boolean noNul(byte[] data) {
        for (byte b : data) {
            if (b == 0) {
                return false;
            }
        }
        return true;
    }
}
