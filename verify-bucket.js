console.log('Verifying storage bucket...'); import('./src/lib/documents').then(m => m.documentService.verifyStorageBucket()).then(() => console.log('Verification complete'));
