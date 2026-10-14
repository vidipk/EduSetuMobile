import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export interface UploadDescriptor { uri: string; name: string; mimeType: string; size?: number }

const fromAsset = (asset: { uri: string; fileName?: string | null; mimeType?: string | null; fileSize?: number | null }): UploadDescriptor => ({
  uri: asset.uri,
  name: asset.fileName ?? 'upload',
  mimeType: asset.mimeType ?? 'application/octet-stream',
  size: asset.fileSize ?? undefined,
});

export async function pickDocument(): Promise<UploadDescriptor | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  return result.canceled ? null : fromAsset(result.assets[0]);
}

export async function pickImage(): Promise<UploadDescriptor | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo library permission is required to choose an image.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  return result.canceled ? null : fromAsset(result.assets[0]);
}

export async function captureImage(): Promise<UploadDescriptor | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Camera permission is required to take a photo.');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  return result.canceled ? null : fromAsset(result.assets[0]);
}

export function createMultipartFile(descriptor: UploadDescriptor) {
  return { uri: descriptor.uri, name: descriptor.name, type: descriptor.mimeType };
}
