package com.project.ai_resumerag_be.pipeline;

import com.project.ai_resumerag_be.entity.Company;
import com.project.ai_resumerag_be.entity.Job;
import com.project.ai_resumerag_be.entity.User;
import com.project.ai_resumerag_be.enumerators.Role;
import com.project.ai_resumerag_be.exception.BadRequestException;
import com.project.ai_resumerag_be.exception.ResourceNotFoundException;
import com.project.ai_resumerag_be.repository.CandidateRepository;
import com.project.ai_resumerag_be.service.AiResultStore;
import com.project.ai_resumerag_be.service.CandidateService;
import com.project.ai_resumerag_be.service.FileStorageService;
import com.project.ai_resumerag_be.service.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BatchServiceTest {

    @Mock CandidateService candidateService;
    @Mock ResumeBatchRepository batches;
    @Mock ResumeTaskRepository tasks;
    @Mock CandidateRepository candidates;
    @Mock TaskStore store;
    @Mock FileStorageService fileStorage;
    @Mock AiResultStore aiResults;

    private final PipelineProperties properties = new PipelineProperties();
    private BatchService service;
    private Company company;
    private Job job;
    private UUID jobId;
    private final List<ResumeTask> inserted = new ArrayList<>();

    @BeforeEach
    void setUp() throws IOException {
        service = new BatchService(candidateService, batches, tasks, candidates, store, fileStorage, aiResults, properties);
        company = Company.builder().id(UUID.randomUUID()).companyName("Acme").build();
        User recruiter = User.builder().id(UUID.randomUUID()).role(Role.RECRUITER).company(company).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new CustomUserDetails(recruiter), null));

        jobId = UUID.randomUUID();
        job = new Job();
        job.setId(jobId);
        job.setCompany(company);
        lenient().when(candidateService.requireOwnedJob(jobId)).thenReturn(job);
        lenient().when(batches.save(any(ResumeBatch.class))).thenAnswer(inv -> {
            ResumeBatch b = inv.getArgument(0);
            b.setId(UUID.randomUUID());
            return b;
        });
        lenient().when(batches.findById(any())).thenAnswer(inv -> Optional.empty());
        lenient().when(fileStorage.storeFile(any(), anyString())).thenAnswer(inv -> "resumes/" + jobId + "/" + UUID.randomUUID());
        lenient().when(store.insertTask(any())).thenAnswer(inv -> {
            inserted.add(inv.getArgument(0));
            return true;
        });
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private static MultipartFile pdf(String name, String body) {
        return new MockMultipartFile("files", name, "application/pdf", ("%PDF-1.7\n" + body).getBytes(StandardCharsets.US_ASCII));
    }

    private ResumeTask only() {
        assertEquals(1, inserted.size());
        return inserted.get(0);
    }

    // ------------------------------------------------------------- upload

    @Test
    void uploadQueuesEachFileAndReturnsWithoutCallingAnyAiService() {
        ResumeBatch batch = service.createBatch(jobId, List.of(pdf("a.pdf", "one"), pdf("b.pdf", "two")));

        assertEquals(2, batch.getTotalFiles());
        assertEquals(2, inserted.size());
        assertTrue(inserted.stream().allMatch(t -> t.getStatus() == ResumeTaskStatus.QUEUED && t.getStage() == ResumeTaskStage.EXTRACT));
        assertTrue(inserted.stream().allMatch(t -> t.getDedupeKey() != null && t.getSha256().length() == 64));
        assertEquals(company.getId(), batch.getCompanyId());
        verify(store).refreshBatch(batch.getId());
    }

    @Test
    void anotherCompaniesJobIsNotFoundAndNothingIsStored() throws IOException {
        UUID foreignJob = UUID.randomUUID();
        when(candidateService.requireOwnedJob(foreignJob)).thenThrow(new ResourceNotFoundException("Job not found: " + foreignJob));

        assertThrows(ResourceNotFoundException.class, () -> service.createBatch(foreignJob, List.of(pdf("a.pdf", "x"))));

        verify(batches, never()).save(any(ResumeBatch.class));
        verify(fileStorage, never()).storeFile(any(), anyString());
        verify(store, never()).insertTask(any());
    }

    @Test
    void anExactDuplicateInTheSameUploadIsRecordedNotProcessedTwice() throws IOException {
        service.createBatch(jobId, List.of(pdf("a.pdf", "same bytes"), pdf("copy-of-a.pdf", "same bytes")));

        assertEquals(2, inserted.size());
        assertEquals(ResumeTaskStatus.QUEUED, inserted.get(0).getStatus());
        assertEquals(ResumeTaskStatus.DUPLICATE, inserted.get(1).getStatus());
        assertEquals("DUPLICATE_FILE", inserted.get(1).getErrorCode());
        assertNull(inserted.get(1).getDedupeKey());
        verify(fileStorage, times(1)).storeFile(any(), anyString()); // the duplicate is never written to disk
    }

    @Test
    void aFileAlreadyUploadedForTheJobIsADuplicate() throws IOException {
        when(tasks.existsByDedupeKey(anyString())).thenReturn(true);

        service.createBatch(jobId, List.of(pdf("a.pdf", "seen before")));

        assertEquals(ResumeTaskStatus.DUPLICATE, only().getStatus());
        verify(fileStorage, never()).storeFile(any(), anyString());
    }

    @Test
    void aRaceOnTheDuplicateGuardKeepsOneCopyAndCleansUpTheOther() throws IOException {
        when(store.insertTask(any())).thenReturn(false, true); // first insert loses the unique-key race, the duplicate row is saved

        service.createBatch(jobId, List.of(pdf("a.pdf", "raced")));

        verify(fileStorage).deleteFile(anyString());
        verify(store, times(2)).insertTask(any());
    }

    @Test
    void oneBadFileDoesNotSinkTheBatch() {
        MultipartFile exe = new MockMultipartFile("files", "setup.exe", "application/octet-stream", new byte[]{'M', 'Z', 1, 2});
        MultipartFile lie = new MockMultipartFile("files", "cv.pdf", "application/pdf", new byte[]{'M', 'Z', 1, 2});
        MultipartFile empty = new MockMultipartFile("files", "empty.pdf", "application/pdf", new byte[0]);

        service.createBatch(jobId, List.of(pdf("good.pdf", "ok"), exe, lie, empty));

        assertEquals(4, inserted.size());
        assertEquals(ResumeTaskStatus.QUEUED, inserted.get(0).getStatus());
        assertEquals("UNSUPPORTED_TYPE", inserted.get(1).getErrorCode());
        assertEquals("INVALID_CONTENT", inserted.get(2).getErrorCode());
        assertEquals("EMPTY_FILE", inserted.get(3).getErrorCode());
        assertTrue(inserted.subList(1, 4).stream().allMatch(t -> t.getStatus() == ResumeTaskStatus.FAILED && t.getFileUrl() == null));
    }

    @Test
    void anUnreadableUploadIsRecordedAsFailedAndTheRestContinue() throws IOException {
        MultipartFile broken = mock(MultipartFile.class);
        when(broken.getOriginalFilename()).thenReturn("broken.pdf");
        when(broken.getSize()).thenReturn(100L);
        when(broken.getInputStream()).thenThrow(new IOException("disk error"));

        service.createBatch(jobId, List.of(broken, pdf("good.pdf", "ok")));

        assertEquals(2, inserted.size());
        assertEquals("UPLOAD_ERROR", inserted.get(0).getErrorCode());
        assertEquals(ResumeTaskStatus.QUEUED, inserted.get(1).getStatus());
    }

    @Test
    void pathsInClientFileNamesAreNeutralised() {
        service.createBatch(jobId, List.of(pdf("../../etc/passwd.pdf", "x")));
        assertEquals("passwd.pdf", only().getFileName());
    }

    @Test
    void tooManyFilesAreRejectedUpFront() {
        properties.getUpload().setMaxFiles(2);
        List<MultipartFile> files = List.of(pdf("a.pdf", "1"), pdf("b.pdf", "2"), pdf("c.pdf", "3"));
        BadRequestException e = assertThrows(BadRequestException.class, () -> service.createBatch(jobId, files));
        assertTrue(e.getMessage().contains("at most 2"));
        verify(batches, never()).save(any(ResumeBatch.class));
    }

    @Test
    void anOversizedBatchIsRejectedUpFront() {
        properties.getUpload().setMaxBatchSize(DataSize.ofBytes(20));
        assertThrows(BadRequestException.class, () -> service.createBatch(jobId, List.of(pdf("a.pdf", "this is more than twenty bytes"))));
        verify(batches, never()).save(any(ResumeBatch.class));
    }

    @Test
    void anEmptyUploadIsRejected() {
        assertThrows(BadRequestException.class, () -> service.createBatch(jobId, List.of()));
        assertThrows(BadRequestException.class, () -> service.createBatch(jobId, null));
    }

    @Test
    void theFileCountLimitDefaultsToFiveHundred() {
        assertEquals(500, new PipelineProperties().getUpload().getMaxFiles());
    }

    // ------------------------------------------------------------- access

    @Test
    void progressOfABatchFromAnotherCompanyIsHidden() {
        UUID batchId = UUID.randomUUID();
        ResumeBatch foreign = ResumeBatch.builder().id(batchId).jobId(jobId).companyId(UUID.randomUUID()).totalFiles(1).build();
        when(batches.findById(batchId)).thenReturn(Optional.of(foreign));

        // The job is reachable, but the batch row belongs to a different company: treat it as missing.
        assertThrows(ResourceNotFoundException.class, () -> service.progress(batchId));
    }

    @Test
    void aRecruiterCannotReadBatchesOfAJobTheyDoNotOwn() {
        UUID batchId = UUID.randomUUID();
        UUID otherJob = UUID.randomUUID();
        when(batches.findById(batchId)).thenReturn(Optional.of(ResumeBatch.builder().id(batchId).jobId(otherJob).companyId(company.getId()).totalFiles(1).build()));
        when(candidateService.requireOwnedJob(otherJob)).thenThrow(new ResourceNotFoundException("Job not found"));

        assertThrows(ResourceNotFoundException.class, () -> service.progress(batchId));
        assertThrows(ResourceNotFoundException.class, () -> service.results(batchId));
        assertThrows(ResourceNotFoundException.class, () -> service.retryFailed(batchId));
        assertThrows(ResourceNotFoundException.class, () -> service.listTasks(batchId, null, 0, 50));
        verify(store, never()).retryFailed(any());
    }

    @Test
    void anUnknownBatchIsNotFound() {
        UUID missing = UUID.randomUUID();
        when(batches.findById(missing)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> service.progress(missing));
    }

    @Test
    void aTaskFromAnotherBatchCannotBeRetriedThroughThisOne() {
        UUID batchId = UUID.randomUUID();
        when(batches.findById(batchId)).thenReturn(Optional.of(ResumeBatch.builder().id(batchId).jobId(jobId).companyId(company.getId()).totalFiles(1).build()));
        ResumeTask elsewhere = ResumeTask.builder().id(UUID.randomUUID()).batchId(UUID.randomUUID()).build();
        when(tasks.findById(elsewhere.getId())).thenReturn(Optional.of(elsewhere));

        assertThrows(ResourceNotFoundException.class, () -> service.retryTask(batchId, elsewhere.getId()));
        verify(store, never()).retryOne(any());
    }

    @Test
    void retryDelegatesToTheStoreForAccessibleBatches() {
        UUID batchId = UUID.randomUUID();
        when(batches.findById(batchId)).thenReturn(Optional.of(ResumeBatch.builder().id(batchId).jobId(jobId).companyId(company.getId()).totalFiles(2).build()));
        when(store.retryFailed(batchId)).thenReturn(2);
        assertEquals(2, service.retryFailed(batchId));
    }

    @Test
    void uploadRecordsWhoStartedTheBatch() {
        ArgumentCaptor<ResumeBatch> saved = ArgumentCaptor.forClass(ResumeBatch.class);
        service.createBatch(jobId, List.of(pdf("a.pdf", "x")));
        verify(batches).save(saved.capture());
        assertNotNull(saved.getValue().getCreatedBy());
    }
}
