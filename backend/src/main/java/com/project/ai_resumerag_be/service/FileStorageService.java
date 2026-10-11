package com.project.ai_resumerag_be.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;

public interface FileStorageService {

    String storeFile(MultipartFile file, String directory) throws IOException;

    String getFilePath(String fileUrl);

    void deleteFile(String fileUrl) throws IOException;
}