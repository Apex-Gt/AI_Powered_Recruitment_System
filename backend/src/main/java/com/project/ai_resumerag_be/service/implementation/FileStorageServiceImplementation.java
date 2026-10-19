package com.project.ai_resumerag_be.service.implementation;

import com.project.ai_resumerag_be.service.FileStorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Slf4j
@Service
public class FileStorageServiceImplementation implements FileStorageService {

    @Value("${app.file.storage.path:./uploads}")
    private String storagePath;

    @Override
    public String storeFile(MultipartFile file, String directory) throws IOException {
        Path uploadDir = Paths.get(storagePath, directory);
        if (!Files.exists(uploadDir)) {
            Files.createDirectories(uploadDir);
        }

        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String fileName = UUID.randomUUID().toString() + extension;
        Path filePath = uploadDir.resolve(fileName);

        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        log.info("Stored file: {}", filePath.toString());
        return directory + "/" + fileName;
    }

    @Override
    public String getFilePath(String fileUrl) {
        // Absolute, because the AI service runs from a different working directory and reads this path directly.
        return Paths.get(storagePath, fileUrl).toAbsolutePath().normalize().toString();
    }

    @Override
    public void deleteFile(String fileUrl) throws IOException {
        Path filePath = Paths.get(storagePath, fileUrl);
        Files.deleteIfExists(filePath);
        log.info("Deleted file: {}", filePath.toString());
    }
}