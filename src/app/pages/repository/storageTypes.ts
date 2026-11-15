// Storage types offered by Kopia. Only those with `supported: true` have a
// form in the new UI so far; the rest open the classic setup.
export interface StorageType {
  id: string;
  label: string;
  description: string;
  supported: boolean;
}

export const STORAGE_TYPES: StorageType[] = [
  { id: "filesystem", label: "Local directory or NAS", description: "A folder on this computer, an external drive or a network share.", supported: true },
  { id: "s3", label: "Amazon S3 or compatible", description: "AWS S3, MinIO, Wasabi, Cloudflare R2 and others.", supported: false },
  { id: "b2", label: "Backblaze B2", description: "Backblaze B2 cloud storage.", supported: false },
  { id: "gcs", label: "Google Cloud Storage", description: "A Google Cloud Storage bucket.", supported: false },
  { id: "azureBlob", label: "Azure Blob Storage", description: "A Microsoft Azure storage container.", supported: false },
  { id: "sftp", label: "SFTP server", description: "Any server reachable over SSH/SFTP.", supported: false },
  { id: "webdav", label: "WebDAV server", description: "Nextcloud, ownCloud and other WebDAV servers.", supported: false },
  { id: "rclone", label: "Rclone remote", description: "Any backend supported by rclone.", supported: false },
  { id: "_server", label: "Kopia repository server", description: "A repository shared by a Kopia server.", supported: false },
  { id: "_token", label: "Repository token", description: "Connect using a token from another Kopia client.", supported: false },
];
