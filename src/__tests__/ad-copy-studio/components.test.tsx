/**
 * Unit Tests for Ad Copy Studio Components
 *
 * Tests WizardStepIndicator and VideoUploadStep components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AdCopyStudioStep, VideoUpload } from '@/types/ad-copy-studio';

// =============================================================================
// Mock Setup
// =============================================================================

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// =============================================================================
// Component Imports
// =============================================================================

import { WizardStepIndicator } from '@/components/ad-copy-studio/WizardStepIndicator';
import { VideoUploadStep } from '@/components/ad-copy-studio/steps/VideoUploadStep';

// =============================================================================
// WizardStepIndicator Tests
// =============================================================================

describe('WizardStepIndicator', () => {
  const defaultProps = {
    currentStep: 1 as AdCopyStudioStep,
    completedSteps: [] as AdCopyStudioStep[],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render all 5 steps', () => {
      render(<WizardStepIndicator {...defaultProps} />);

      // Check for all step titles
      expect(screen.getByText('Upload')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('Configure')).toBeInTheDocument();
      expect(screen.getByText('Generate')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('should render steps as buttons', () => {
      render(<WizardStepIndicator {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(5);
    });

    it('should render navigation landmark', () => {
      render(<WizardStepIndicator {...defaultProps} />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Wizard progress');
    });
  });

  describe('step status display', () => {
    it('should highlight current step', () => {
      render(
        <WizardStepIndicator
          currentStep={2}
          completedSteps={[1]}
        />
      );

      // Step 2 should be marked as current
      const reviewButton = screen.getByRole('button', { name: /Step 2.*Review.*current/i });
      expect(reviewButton).toHaveAttribute('aria-current', 'step');
    });

    it('should show completed steps with checkmark', () => {
      render(
        <WizardStepIndicator
          currentStep={3}
          completedSteps={[1, 2]}
        />
      );

      // Steps 1 and 2 should be marked as completed
      const step1Button = screen.getByRole('button', { name: /Step 1.*Upload.*completed/i });
      const step2Button = screen.getByRole('button', { name: /Step 2.*Review.*completed/i });

      expect(step1Button).toBeInTheDocument();
      expect(step2Button).toBeInTheDocument();
    });

    it('should show upcoming steps without checkmark or current indicator', () => {
      render(
        <WizardStepIndicator
          currentStep={2}
          completedSteps={[1]}
        />
      );

      // Step 3, 4, 5 should not have aria-current
      const step3Button = screen.getByRole('button', { name: /Step 3.*Configure/i });
      const step4Button = screen.getByRole('button', { name: /Step 4.*Generate/i });
      const step5Button = screen.getByRole('button', { name: /Step 5.*Export/i });

      expect(step3Button).not.toHaveAttribute('aria-current');
      expect(step4Button).not.toHaveAttribute('aria-current');
      expect(step5Button).not.toHaveAttribute('aria-current');
    });
  });

  describe('step navigation', () => {
    it('should call onStepClick when clicking navigable step', () => {
      const onStepClick = vi.fn();
      const canNavigateToStep = vi.fn().mockReturnValue(true);

      render(
        <WizardStepIndicator
          currentStep={3}
          completedSteps={[1, 2]}
          onStepClick={onStepClick}
          canNavigateToStep={canNavigateToStep}
        />
      );

      // Click on step 1 (completed, should be navigable)
      fireEvent.click(screen.getByRole('button', { name: /Step 1.*Upload/i }));

      expect(onStepClick).toHaveBeenCalledWith(1);
    });

    it('should not call onStepClick when clicking non-navigable step', () => {
      const onStepClick = vi.fn();
      const canNavigateToStep = vi.fn().mockReturnValue(false);

      render(
        <WizardStepIndicator
          currentStep={1}
          completedSteps={[]}
          onStepClick={onStepClick}
          canNavigateToStep={canNavigateToStep}
        />
      );

      // Click on step 5 (not navigable from step 1)
      fireEvent.click(screen.getByRole('button', { name: /Step 5.*Export/i }));

      expect(onStepClick).not.toHaveBeenCalled();
    });

    it('should handle keyboard navigation with Enter key', () => {
      const onStepClick = vi.fn();
      const canNavigateToStep = vi.fn().mockReturnValue(true);

      render(
        <WizardStepIndicator
          currentStep={2}
          completedSteps={[1]}
          onStepClick={onStepClick}
          canNavigateToStep={canNavigateToStep}
        />
      );

      // Press Enter on step 1
      fireEvent.keyDown(screen.getByRole('button', { name: /Step 1.*Upload/i }), {
        key: 'Enter',
      });

      expect(onStepClick).toHaveBeenCalledWith(1);
    });

    it('should handle keyboard navigation with Space key', () => {
      const onStepClick = vi.fn();
      const canNavigateToStep = vi.fn().mockReturnValue(true);

      render(
        <WizardStepIndicator
          currentStep={2}
          completedSteps={[1]}
          onStepClick={onStepClick}
          canNavigateToStep={canNavigateToStep}
        />
      );

      // Press Space on step 1
      fireEvent.keyDown(screen.getByRole('button', { name: /Step 1.*Upload/i }), {
        key: ' ',
      });

      expect(onStepClick).toHaveBeenCalledWith(1);
    });

    it('should disable non-navigable future steps', () => {
      const canNavigateToStep = vi.fn((step: AdCopyStudioStep) => step <= 2);

      render(
        <WizardStepIndicator
          currentStep={2}
          completedSteps={[1]}
          canNavigateToStep={canNavigateToStep}
        />
      );

      // Steps 3, 4, 5 should be disabled
      const step3Button = screen.getByRole('button', { name: /Step 3.*Configure/i });
      const step4Button = screen.getByRole('button', { name: /Step 4.*Generate/i });
      const step5Button = screen.getByRole('button', { name: /Step 5.*Export/i });

      expect(step3Button).toBeDisabled();
      expect(step4Button).toBeDisabled();
      expect(step5Button).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should have proper aria labels for steps', () => {
      render(
        <WizardStepIndicator
          currentStep={2}
          completedSteps={[1]}
        />
      );

      // Check aria-label format
      expect(screen.getByRole('button', { name: /Step 1.*Upload.*completed/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Step 2.*Review.*current/i })).toBeInTheDocument();
    });
  });
});

// =============================================================================
// VideoUploadStep Tests
// =============================================================================

describe('VideoUploadStep', () => {
  const defaultProps = {
    videos: [] as VideoUpload[],
    isUploading: false,
    error: null,
    onUploadFiles: vi.fn(),
    onImportGDrive: vi.fn(),
    onRemoveVideo: vi.fn(),
    onClearError: vi.fn(),
    onComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render upload area', () => {
      render(<VideoUploadStep {...defaultProps} />);

      expect(screen.getByText('Drag and drop videos here')).toBeInTheDocument();
      expect(screen.getByText(/click to browse/i)).toBeInTheDocument();
    });

    it('should render GDrive import input', () => {
      render(<VideoUploadStep {...defaultProps} />);

      expect(screen.getByText('Import from Google Drive')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Paste Google Drive link/i)).toBeInTheDocument();
    });

    it('should render header with title', () => {
      render(<VideoUploadStep {...defaultProps} />);

      expect(screen.getByText('Upload Your Campaign Videos')).toBeInTheDocument();
      expect(screen.getByText(/Upload up to 5 videos/i)).toBeInTheDocument();
    });

    it('should render file format info', () => {
      render(<VideoUploadStep {...defaultProps} />);

      expect(screen.getByText(/MP4, MOV, WebM/i)).toBeInTheDocument();
      expect(screen.getByText(/Max 500MB/i)).toBeInTheDocument();
    });
  });

  describe('complete button state', () => {
    it('should disable complete button when no ready videos', () => {
      render(<VideoUploadStep {...defaultProps} />);

      const completeButton = screen.getByRole('button', { name: /Next.*Review Transcripts/i });
      expect(completeButton).toBeDisabled();
    });

    it('should enable complete button when videos are ready', () => {
      const readyVideo: VideoUpload = {
        id: 'video-1',
        file: null,
        source: 'uploaded',
        filename: 'test.mp4',
        file_size_bytes: 1024 * 1024,
        status: 'ready',
        progress: 100,
      };

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={[readyVideo]}
        />
      );

      const completeButton = screen.getByRole('button', { name: /Next.*Review Transcripts/i });
      expect(completeButton).not.toBeDisabled();
    });

    it('should disable complete button when uploading', () => {
      const readyVideo: VideoUpload = {
        id: 'video-1',
        file: null,
        source: 'uploaded',
        filename: 'test.mp4',
        file_size_bytes: 1024 * 1024,
        status: 'ready',
        progress: 100,
      };

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={[readyVideo]}
          isUploading={true}
        />
      );

      const completeButton = screen.getByRole('button', { name: /Next.*Review Transcripts/i });
      expect(completeButton).toBeDisabled();
    });

    it('should call onComplete when complete button clicked', () => {
      const onComplete = vi.fn();
      const readyVideo: VideoUpload = {
        id: 'video-1',
        file: null,
        source: 'uploaded',
        filename: 'test.mp4',
        file_size_bytes: 1024 * 1024,
        status: 'ready',
        progress: 100,
      };

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={[readyVideo]}
          onComplete={onComplete}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Next.*Review Transcripts/i }));

      expect(onComplete).toHaveBeenCalled();
    });
  });

  describe('video list display', () => {
    it('should display uploaded videos', () => {
      const uploadedVideo: VideoUpload = {
        id: 'video-1',
        file: null,
        source: 'uploaded',
        filename: 'campaign_ad.mp4',
        file_size_bytes: 50 * 1024 * 1024, // 50MB
        status: 'ready',
        progress: 100,
        duration_sec: 120,
      };

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={[uploadedVideo]}
        />
      );

      expect(screen.getByText('campaign_ad.mp4')).toBeInTheDocument();
      // Look for the file size in the video info section specifically
      expect(screen.getByText('50 MB')).toBeInTheDocument();
      expect(screen.getByText('2:00')).toBeInTheDocument();
    });

    it('should show video count', () => {
      const videos: VideoUpload[] = [
        {
          id: 'video-1',
          file: null,
          source: 'uploaded',
          filename: 'video1.mp4',
          file_size_bytes: 1024,
          status: 'ready',
          progress: 100,
        },
        {
          id: 'video-2',
          file: null,
          source: 'gdrive',
          filename: 'video2.mp4',
          file_size_bytes: 2048,
          status: 'ready',
          progress: 100,
        },
      ];

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={videos}
        />
      );

      expect(screen.getByText('Videos (2/5)')).toBeInTheDocument();
    });

    it('should show remaining slots', () => {
      const videos: VideoUpload[] = [
        {
          id: 'video-1',
          file: null,
          source: 'uploaded',
          filename: 'video1.mp4',
          file_size_bytes: 1024,
          status: 'ready',
          progress: 100,
        },
      ];

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={videos}
        />
      );

      expect(screen.getByText('4 slots remaining')).toBeInTheDocument();
    });

    it('should show upload progress for uploading videos', () => {
      const uploadingVideo: VideoUpload = {
        id: 'video-1',
        file: null,
        source: 'uploaded',
        filename: 'uploading.mp4',
        file_size_bytes: 100 * 1024 * 1024,
        status: 'uploading',
        progress: 45,
      };

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={[uploadingVideo]}
        />
      );

      expect(screen.getByText('Uploading')).toBeInTheDocument();
    });

    it('should show GDrive badge for imported videos', () => {
      const gdriveVideo: VideoUpload = {
        id: 'video-1',
        file: null,
        gdrive_url: 'https://drive.google.com/file/d/123',
        source: 'gdrive',
        filename: 'gdrive_video.mp4',
        file_size_bytes: 1024,
        status: 'ready',
        progress: 100,
      };

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={[gdriveVideo]}
        />
      );

      expect(screen.getByText('Google Drive')).toBeInTheDocument();
    });
  });

  describe('video removal', () => {
    it('should call onRemoveVideo when remove button clicked', () => {
      const onRemoveVideo = vi.fn();
      const video: VideoUpload = {
        id: 'video-123',
        file: null,
        source: 'uploaded',
        filename: 'test.mp4',
        file_size_bytes: 1024,
        status: 'ready',
        progress: 100,
      };

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={[video]}
          onRemoveVideo={onRemoveVideo}
        />
      );

      const removeButton = screen.getByRole('button', { name: /Remove test.mp4/i });
      fireEvent.click(removeButton);

      expect(onRemoveVideo).toHaveBeenCalledWith('video-123');
    });

    it('should disable remove button while processing', () => {
      const video: VideoUpload = {
        id: 'video-1',
        file: null,
        source: 'uploaded',
        filename: 'processing.mp4',
        file_size_bytes: 1024,
        status: 'transcribing',
        progress: 50,
      };

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={[video]}
        />
      );

      const removeButton = screen.getByRole('button', { name: /Remove processing.mp4/i });
      expect(removeButton).toBeDisabled();
    });
  });

  describe('error handling', () => {
    it('should display error message', () => {
      render(
        <VideoUploadStep
          {...defaultProps}
          error="Upload failed: Network error"
        />
      );

      expect(screen.getByText('Upload failed: Network error')).toBeInTheDocument();
    });

    it('should call onClearError when dismiss button clicked', () => {
      const onClearError = vi.fn();

      render(
        <VideoUploadStep
          {...defaultProps}
          error="Some error"
          onClearError={onClearError}
        />
      );

      const dismissButton = screen.getByRole('button', { name: /Dismiss error/i });
      fireEvent.click(dismissButton);

      expect(onClearError).toHaveBeenCalled();
    });

    it('should show video-level error message', () => {
      const errorVideo: VideoUpload = {
        id: 'video-1',
        file: null,
        source: 'uploaded',
        filename: 'error.mp4',
        file_size_bytes: 1024,
        status: 'error',
        progress: 0,
        error_message: 'File format not supported',
      };

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={[errorVideo]}
        />
      );

      expect(screen.getByText('File format not supported')).toBeInTheDocument();
    });
  });

  describe('GDrive import', () => {
    it('should call onImportGDrive when import button clicked', async () => {
      const onImportGDrive = vi.fn();

      render(
        <VideoUploadStep
          {...defaultProps}
          onImportGDrive={onImportGDrive}
        />
      );

      const input = screen.getByPlaceholderText(/Paste Google Drive link/i);
      const importButton = screen.getByRole('button', { name: 'Import' });

      fireEvent.change(input, {
        target: { value: 'https://drive.google.com/file/d/123/view' },
      });
      fireEvent.click(importButton);

      expect(onImportGDrive).toHaveBeenCalledWith([
        'https://drive.google.com/file/d/123/view',
      ]);
    });

    it('should call onImportGDrive when Enter pressed in input', () => {
      const onImportGDrive = vi.fn();

      render(
        <VideoUploadStep
          {...defaultProps}
          onImportGDrive={onImportGDrive}
        />
      );

      const input = screen.getByPlaceholderText(/Paste Google Drive link/i);

      fireEvent.change(input, {
        target: { value: 'https://drive.google.com/file/d/456/view' },
      });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onImportGDrive).toHaveBeenCalledWith([
        'https://drive.google.com/file/d/456/view',
      ]);
    });

    it('should disable import when max videos reached', () => {
      const maxVideos: VideoUpload[] = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `video-${i}`,
          file: null,
          source: 'uploaded' as const,
          filename: `video${i}.mp4`,
          file_size_bytes: 1024,
          status: 'ready' as const,
          progress: 100,
        }));

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={maxVideos}
        />
      );

      const input = screen.getByPlaceholderText(/Paste Google Drive link/i);
      expect(input).toBeDisabled();
    });
  });

  describe('meta specs badge', () => {
    it('should show Meta specs badge for compliant videos', () => {
      const compliantVideo: VideoUpload = {
        id: 'video-1',
        file: null,
        source: 'uploaded',
        filename: 'compliant.mp4',
        file_size_bytes: 1024,
        status: 'ready',
        progress: 100,
        meets_meta_specs: true,
      };

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={[compliantVideo]}
        />
      );

      expect(screen.getByText('Meta specs')).toBeInTheDocument();
    });

    it('should not show Meta specs badge for non-compliant videos', () => {
      const nonCompliantVideo: VideoUpload = {
        id: 'video-1',
        file: null,
        source: 'uploaded',
        filename: 'non_compliant.mp4',
        file_size_bytes: 1024,
        status: 'ready',
        progress: 100,
        meets_meta_specs: false,
      };

      render(
        <VideoUploadStep
          {...defaultProps}
          videos={[nonCompliantVideo]}
        />
      );

      expect(screen.queryByText('Meta specs')).not.toBeInTheDocument();
    });
  });
});
