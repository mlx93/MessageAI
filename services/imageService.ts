/**
 * Image Service
 * 
 * Handles image picking, compression, and upload to Cloud Storage
 * Compresses images larger than 5MB before upload
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Pick an image from the device's media library
 * 
 * @returns Image URI or null if cancelled/failed
 */
export const pickImage = async (): Promise<string | null> => {
  try {
    // Request permission to access media library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('Permission to access photos denied');
      return null;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    console.error('Failed to pick image:', error);
    return null;
  }
};

/**
 * Compress an image to reduce file size
 * 
 * Resizes to max width of 1920px and compresses quality to 0.7
 * 
 * @param uri - URI of the image to compress
 * @returns URI of the compressed image
 */
export const compressImage = async (uri: string): Promise<string> => {
  try {
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1920 } }], // Max width 1920px, maintains aspect ratio
      {
        compress: 0.7, // 70% quality
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    
    return compressed.uri;
  } catch (error) {
    console.error('Failed to compress image:', error);
    throw error;
  }
};

/**
 * Get file size from URI
 * 
 * @param uri - File URI
 * @returns File size in bytes
 */
const getFileSize = async (uri: string): Promise<number> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch (error) {
    console.error('Failed to get file size:', error);
    return 0;
  }
};

/**
 * Upload an image to Cloud Storage
 * 
 * Automatically compresses images larger than 5MB
 * 
 * @param uri - URI of the image to upload
 * @param conversationId - ID of the conversation (for organizing storage)
 * @returns Download URL of the uploaded image
 */
export const uploadImage = async (uri: string, conversationId: string): Promise<string> => {
  try {
    // Check file size
    const size = await getFileSize(uri);
    let finalUri = uri;
    
    // Compress if larger than 5MB
    if (size > 5 * 1024 * 1024) {
      console.log('Image is large, compressing...');
      finalUri = await compressImage(uri);
    }
    
    // Fetch the image as a blob
    const response = await fetch(finalUri);
    const blob = await response.blob();
    
    // Create a reference to the storage location
    const timestamp = Date.now();
    const filename = `${timestamp}.jpg`;
    const storageRef = ref(storage, `images/${conversationId}/${filename}`);
    
    // Upload the blob
    console.log('Uploading image...');
    await uploadBytes(storageRef, blob);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('Image uploaded successfully:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('Failed to upload image:', error);
    throw error;
  }
};

/**
 * Pick and upload an image in one operation
 * 
 * @param conversationId - ID of the conversation
 * @returns Download URL of the uploaded image, or null if cancelled/failed
 */
export const pickAndUploadImage = async (conversationId: string): Promise<string | null> => {
  try {
    // Pick image
    const uri = await pickImage();
    if (!uri) {
      return null;
    }
    
    // Upload image
    const downloadURL = await uploadImage(uri, conversationId);
    return downloadURL;
  } catch (error) {
    console.error('Failed to pick and upload image:', error);
    throw error;
  }
};

