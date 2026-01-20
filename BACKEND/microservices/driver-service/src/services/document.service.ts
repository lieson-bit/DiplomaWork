import { logger } from '../utils/logger';
import { uploadService } from './upload.service';
import { getDocumentRepository } from '../repositories';

export class DocumentService {
  private documentRepository = getDocumentRepository();

  async getExpiringDocuments(daysBefore: number = 30): Promise<any[]> {
    return await this.documentRepository.getExpiringDocuments(daysBefore);
  }

  async bulkUpdateDocumentStatus(
    documentIds: string[],
    status: string,
    verifiedBy?: string,
    rejectionReason?: string
  ): Promise<{ count: number }> {
    let updatedCount = 0;
    for (const docId of documentIds) {
      try {
        await this.documentRepository.updateStatus(docId, status, verifiedBy, rejectionReason);
        updatedCount++;
      } catch (error) {
        logger.error(`Failed to update document ${docId}:`, error);
      }
    }
    
    logger.info(`Bulk updated ${updatedCount} documents to status: ${status}`);
    return { count: updatedCount };
  }

  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      const document = await this.documentRepository.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      const filePath = document.fileUrl.replace(`${process.env.APP_URL}/uploads/`, '');
      await uploadService.deleteFile(filePath);

      const result = await this.documentRepository.delete(documentId);
      logger.info(`Deleted document: ${documentId}`);
      return result;
    } catch (error: any) {
      logger.error(`Failed to delete document ${documentId}:`, error);
      return false;
    }
  }

  async getDocumentStatistics(): Promise<any> {
    const [pending, approved, rejected, expired] = await Promise.all([
      this.documentRepository.getDocumentsByStatus('pending'),
      this.documentRepository.getDocumentsByStatus('approved'),
      this.documentRepository.getDocumentsByStatus('rejected'),
      this.documentRepository.getDocumentsByStatus('expired')
    ]);

    const total = pending.length + approved.length + rejected.length + expired.length;
    const expiring = await this.getExpiringDocuments(30);

    return {
      total,
      byStatus: {
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length,
        expired: expired.length
      },
      expiringCount: expiring.length
    };
  }
}

export const documentService = new DocumentService();