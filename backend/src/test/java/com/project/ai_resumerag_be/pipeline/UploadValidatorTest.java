package com.project.ai_resumerag_be.pipeline;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class UploadValidatorTest {

    private static final Set<String> ALLOWED = Set.of("pdf", "docx", "txt");
    private static final long TEN_MB = 10L * 1024 * 1024;

    private static UploadValidator.Verdict check(String name, byte[] content) throws IOException {
        return UploadValidator.check(name, content.length, new ByteArrayInputStream(content), ALLOWED, TEN_MB);
    }

    @Test
    void realPdfPasses() throws IOException {
        assertTrue(check("cv.pdf", "%PDF-1.7\nbody".getBytes(StandardCharsets.US_ASCII)).ok());
    }

    @Test
    void docxMustBeAZip() throws IOException {
        assertTrue(check("cv.docx", new byte[]{'P', 'K', 3, 4, 0, 0}).ok());
        assertEquals("INVALID_CONTENT", check("cv.docx", "plain text".getBytes()).code());
    }

    @Test
    void extensionLiesAreCaught() throws IOException {
        // A Windows executable renamed to .pdf.
        assertEquals("INVALID_CONTENT", check("resume.pdf", new byte[]{'M', 'Z', (byte) 0x90, 0}).code());
    }

    @Test
    void unsupportedTypesAreRejected() throws IOException {
        assertEquals("UNSUPPORTED_TYPE", check("cv.exe", new byte[]{1, 2, 3}).code());
        assertEquals("UNSUPPORTED_TYPE", check("cv.doc", new byte[]{1, 2, 3}).code());
        assertEquals("UNSUPPORTED_TYPE", check("noextension", new byte[]{1}).code());
    }

    @Test
    void emptyAndOversizedFilesAreRejected() throws IOException {
        assertEquals("EMPTY_FILE", UploadValidator.check("cv.pdf", 0, new ByteArrayInputStream(new byte[0]), ALLOWED, TEN_MB).code());
        assertEquals("FILE_TOO_LARGE", UploadValidator.check("cv.pdf", TEN_MB + 1, new ByteArrayInputStream("%PDF-".getBytes()), ALLOWED, TEN_MB).code());
    }

    @Test
    void textWithBinaryBytesIsRejected() throws IOException {
        assertTrue(check("cv.txt", "Jane Doe\njane@example.com".getBytes()).ok());
        assertEquals("INVALID_CONTENT", check("cv.txt", new byte[]{'a', 0, 'b'}).code());
    }

    @Test
    void extensionMatchingIsCaseInsensitive() throws IOException {
        assertTrue(check("CV.PDF", "%PDF-1.4".getBytes()).ok());
    }

    @Test
    void clientSuppliedPathsAreStripped() {
        assertEquals("cv.pdf", UploadValidator.safeName("../../etc/cv.pdf"));
        assertEquals("cv.pdf", UploadValidator.safeName("C:\\Users\\x\\cv.pdf"));
        assertEquals("resume", UploadValidator.safeName(null));
        assertEquals("resume", UploadValidator.safeName("  "));
        assertTrue(UploadValidator.safeName("a".repeat(500) + ".pdf").length() <= 200);
    }
}
