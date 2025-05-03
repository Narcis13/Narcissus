<template>
    <q-page padding>
      <q-btn
        flat
        round
        dense
        icon="arrow_back"
        :to="isEditMode ? { name: 'ArticleView', params: { id: articleId } } : { name: 'ArticleList' }"
        class="q-mb-md"
        aria-label="Back"
      />
  
      <h1 class="text-h4 q-mb-lg">{{ isEditMode ? 'Edit Article' : 'Create New Article' }}</h1>
  
      <q-spinner v-if="isLoading" size="lg" color="primary" class="q-mt-xl block" />
  
      <q-banner v-else-if="errorLoading" class="bg-negative text-white q-mt-md">
        {{ errorLoading }}
      </q-banner>
  
      <q-form v-else @submit.prevent="saveArticle" class="q-gutter-md">
        <q-input
          filled
          v-model="article.title"
          label="Title *"
          lazy-rules
          :rules="[val => !!val || 'Title is required']"
        />
  
        <q-input
          filled
          v-model="article.category"
          label="Category *"
          lazy-rules
          :rules="[val => !!val || 'Category is required']"
        />
  
        <div class="q-mt-xl">
          <h2 class="text-h6 q-mb-md">Content Items</h2>
  
          <q-card
            v-for="(item, index) in article.content"
            :key="index"
            class="q-mb-md"
            bordered
            flat
          >
            <q-card-section>
              <div class="row items-center justify-between q-mb-sm">
                <div class="text-subtitle2 text-grey-7">
                  Item #{{ index + 1 }}: {{ item.type.charAt(0).toUpperCase() + item.type.slice(1) }}
                </div>
                <div>
                  <q-btn
                    flat dense round icon="arrow_upward"
                    @click="moveContentItem(index, -1)"
                    :disable="index === 0"
                    aria-label="Move item up"
                    class="q-mr-xs"
                  />
                  <q-btn
                    flat dense round icon="arrow_downward"
                    @click="moveContentItem(index, 1)"
                    :disable="index === (article.content?.length ?? 0) - 1"
                    aria-label="Move item down"
                     class="q-mr-xs"
                  />
                  <q-btn
                    flat dense round icon="delete" color="negative"
                    @click="removeContentItem(index)"
                    aria-label="Remove item"
                  />
                </div>
              </div>
  
              <!-- Paragraph Editor -->
              <div v-if="item.type === 'PARAGRAPH'">
                <q-editor
                  v-model="item.html"
                  min-height="5rem"
                  :toolbar="[
                    ['bold', 'italic', 'strike', 'underline'],
                    ['link'],
                    ['unordered', 'ordered'],
                    ['viewsource']
                  ]"
                  placeholder="Enter paragraph content..."
                />
              </div>
  
              <!-- File Editor -->
              <div v-else-if="item.type === 'FILE'" class="q-gutter-sm q-mt-sm">
                 <q-input
                    filled dense
                    v-model="item.name"
                    label="Link Text *"
                    lazy-rules
                    :rules="[val => !!val || 'Link text is required']"
                 />
                 <q-input
                    filled dense
                    v-model="item.url"
                    label="File URL *"
                    type="url"
                    lazy-rules
                    :rules="[
                      val => !!val || 'File URL is required',
                      val => /^https?:\/\/.+/.test(val) || 'Must be a valid URL (http/https)'
                      ]"
                  />
                                   <!-- ADDED Q-Uploader -->
                 <q-uploader
                    :url="uploadUrl"
                    label="Upload File (Max 10MB)"
                    field-name="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.jpg,.jpeg,.png,.gif"
                    max-file-size="10485760"
                    auto-upload
                    max-files="1"
                    @uploaded="(info) => onFileUploaded(index, info)"
                    @failed="onUploadFailed"
                    class="q-mt-md"
                    style="max-width: 100%"
                    flat
                    bordered
                 >
                    <template v-slot:list="scope">
                        <!-- Custom list display to show only the file -->
                        <q-list separator v-if="scope.files.length > 0">
                            <q-item v-for="file in scope.files" :key="file.__key">
                                <q-item-section>
                                    <q-item-label class="full-width ellipsis">
                                    {{ file.name }}
                                    </q-item-label>
                                    <q-item-label caption>
                                    Status: {{ file.__status }}
                                        <q-spinner color="primary" size="xs" v-if="file.__status === 'uploading'" />
                                    </q-item-label>
                                    <q-item-label caption>
                                    {{ file.__sizeLabel }} / {{ file.__progressLabel }}
                                    </q-item-label>
                                </q-item-section>

                                <q-item-section v-if="file.__img" thumbnail class="gt-xs">
                                    <img :src="file.__img.src">
                                </q-item-section>

                                <q-item-section top side>
                                    <q-btn
                                    class="gt-xs"
                                    size="12px"
                                    flat
                                    dense
                                    round
                                    icon="delete"
                                    @click="scope.removeFile(file); clearFileUrl(index)"
                                    />
                                </q-item-section>
                            </q-item>
                        </q-list>
                         <div v-else class="text-center q-pa-md text-grey-7">
                            Drop file here or click to browse
                        </div>
                    </template>
                 </q-uploader>
                 <!-- END of Q-Uploader -->
              </div>
  
                            <!-- Image Editor -->
               <div v-else-if="item.type === 'IMAGE'" class="q-gutter-sm q-mt-sm">
                  <q-input
                    filled dense
                    v-model="item.src"
                    label="Image URL *"
                    type="url"
                    lazy-rules
                    :rules="[
                      val => !!val || 'Image URL is required',
                      val => /^https?:\/\/.+/.test(val) || 'Must be a valid URL (http/https)'
                      ]"
                    hint="Enter URL directly or upload an image below" 
                  />
                  <q-input
                    filled dense
                    v-model="item.alt"
                    label="Alt Text *"
                    lazy-rules
                    :rules="[val => !!val || 'Alt text is required for accessibility']"
                 />
                 <img
                   v-if="item.src && /^https?:\/\/.+/.test(item.src)" 
                   :src="item.src"
                   :alt="item.alt || 'Image Preview'"
                   class="q-mt-sm"
                   style="max-width: 200px; max-height: 150px; display: block; border: 1px solid #ccc;"
                  />

                 <!-- ADDED Q-Uploader for Images -->
                 <q-uploader
                    :url="uploadUrl"
                    label="Upload Image (Max 10MB)"
                    field-name="file"
                    accept="image/*,.jpeg,.jpg,.png,.gif,.webp,.svg" 
                    max-file-size="10485760"
                    auto-upload
                    max-files="1"
                    @uploaded="(info) => onImageUploaded(index, info)" 
                    @failed="onUploadFailed" 
                    class="q-mt-md"
                    style="max-width: 100%"
                    flat
                    bordered
                 >
                    <template v-slot:list="scope">
                        <q-list separator v-if="scope.files.length > 0">
                            <q-item v-for="file in scope.files" :key="file.__key">
                                <q-item-section>
                                    <q-item-label class="full-width ellipsis"> {{ file.name }} </q-item-label>
                                    <q-item-label caption> Status: {{ file.__status }}
                                        <q-spinner color="primary" size="xs" v-if="file.__status === 'uploading'" />
                                    </q-item-label>
                                    <q-item-label caption> {{ file.__sizeLabel }} / {{ file.__progressLabel }} </q-item-label>
                                </q-item-section>
                                <q-item-section v-if="file.__img" thumbnail class="gt-xs">
                                    <img :src="file.__img.src"> <!-- Uploader's internal preview -->
                                </q-item-section>
                                <q-item-section top side>
                                    <q-btn class="gt-xs" size="12px" flat dense round icon="delete"
                                        @click="scope.removeFile(file); clearImageUrl(index)" /> <!-- NEW clear handler -->
                                </q-item-section>
                            </q-item>
                        </q-list>
                         <div v-else class="text-center q-pa-md text-grey-7"> Drop image here or click to browse </div>
                    </template>
                 </q-uploader>
                 <!-- END of Q-Uploader for Images -->

              </div>
            </q-card-section>
          </q-card>
  
          <q-banner v-if="!article.content || article.content.length === 0" class="bg-grey-2 q-mb-md">
            No content items added yet. Use the buttons below to add content.
          </q-banner>
  
          <div class="q-mt-md q-gutter-sm">
            <q-btn outline color="primary" icon="notes" label="Add Paragraph" @click="addContentItem('PARAGRAPH')" />
            <q-btn outline color="primary" icon="attachment" label="Add File Link" @click="addContentItem('FILE')" />
            <q-btn outline color="primary" icon="image" label="Add Image" @click="addContentItem('IMAGE')" />
          </div>
        </div>
  
        <q-separator class="q-my-lg" />
  
        <div>
          <q-btn label="Save Article" type="submit" color="primary" :loading="isSaving" />
          <q-btn
            label="Cancel"
            type="button"
            color="grey"
            flat
            class="q-ml-sm"
            :to="isEditMode ? { name: 'ArticleView', params: { id: articleId } } : { name: 'ArticleList' }"
          />
        </div>
      </q-form>
  
    </q-page>
  </template>
  
  <script setup lang="ts">
  import { ref, reactive, onMounted, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import { useQuasar, QForm } from 'quasar';
  import { ArticleService } from 'src/services/ArticleService';
  import { host } from '../config/api';
  import { ArticleInput, ContentItem, ParagraphItem, FileItem, ImageItem } from 'src/types/models';
  
  interface Props {
    id?: string | number; // Optional prop for edit mode
  }
  const props = defineProps<Props>();
  
  const $q = useQuasar();
  const router = useRouter();
  
  // Use reactive for the form object
  const article = reactive<ArticleInput>({
    title: '',
    category: '',
    content: [],
  });
  const API_BASE_URL = host; // Use env variable
const uploadUrl = computed(() => `${API_BASE_URL}/upload/single`); // Make it computed
  const isLoading = ref(false);
  const isSaving = ref(false);
  const errorLoading = ref<string | null>(null);
  
  const articleId = computed(() => props.id ? Number(props.id) : null);
  const isEditMode = computed(() => articleId.value !== null && !isNaN(articleId.value));
  
  const fetchArticleForEdit = async () => {
    if (!isEditMode.value || articleId.value === null) return;
  
    isLoading.value = true;
    errorLoading.value = null;
    try {
      const fetchedArticle = await ArticleService.getArticleById(articleId.value);
      // Use Object.assign or spread to update the reactive object properties
      Object.assign(article, fetchedArticle);
      // Ensure content is always an array
       if (!article.content) {
        article.content = [];
      }
    } catch (error) {
      console.error(`Failed to fetch article ${articleId.value} for editing:`, error);
      errorLoading.value = 'Could not load the article data for editing.';
       $q.notify({ color: 'negative', message: errorLoading.value });
       // Optionally redirect back if loading failed critically
       // router.push({ name: 'ArticleList' });
    } finally {
      isLoading.value = false;
    }
  };
  
  const addContentItem = (type: ContentItem['type']) => {
    let newItem: ContentItem;
    switch (type) {
      case 'PARAGRAPH':
        newItem = { type: 'PARAGRAPH', html: '' };
        break;
      case 'FILE':
        newItem = { type: 'FILE', url: '', name: '' };
        break;
      case 'IMAGE':
        newItem = { type: 'IMAGE', src: '', alt: '' };
        break;
      default:
        // Should not happen with defined types
        console.error('Unknown content type:', type);
        return;
    }
     if (!article.content) {
      article.content = []; // Initialize if null/undefined
     }
    article.content.push(newItem);
  };
  
  const removeContentItem = (index: number) => {
    if (article.content) {
      article.content.splice(index, 1);
    }
  };
  
  const moveContentItem = (index: number, direction: number) => {
    if (!article.content) return;
  
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= article.content.length) {
      return; // Out of bounds
    }
  
    // Simple swap
    const itemToMove = article.content[index];
    article.content[index] = article.content[newIndex];
    article.content[newIndex] = itemToMove;
  
    // Alternative using splice for clarity
    // const [item] = article.content.splice(index, 1);
    // article.content.splice(newIndex, 0, item);
  };
  
  const saveArticle = async () => {
    isSaving.value = true;
    // QForm handles validation triggering on submit, but manual check can be added
    if (!article.title || !article.category) {
        $q.notify({ color: 'warning', message: 'Please fill in Title and Category.' });
        isSaving.value = false;
        return;
    }
  
    try {
      let savedArticle;
      // Create a deep copy of content items, remove 'id' and 'articleId' properties,
      // and ensure each item has a unique 'order' value
      const contentWithoutIds = article.content ? article.content.map((item, index) => {
        const { id, articleId, ...itemWithoutIds } = item as any;
        // Add explicit order property based on index
        return {
          ...itemWithoutIds,
          order: index // Ensure unique order values
        };
      }) : [];

      const payload: ArticleInput = {
        title: article.title,
        category: article.category,
        content: contentWithoutIds
      };
  
      if (isEditMode.value && articleId.value) {
        savedArticle = await ArticleService.updateArticle(articleId.value, payload);
        $q.notify({ color: 'positive', message: 'Article updated successfully!' });
        router.push({ name: 'ArticleView', params: { id: savedArticle.id } });
      } else {
        savedArticle = await ArticleService.createArticle(payload);
        $q.notify({ color: 'positive', message: 'Article created successfully!' });
        router.push({ name: 'ArticleView', params: { id: savedArticle.id } });
      }
  
    } catch (error) {
      console.error('Failed to save article:', error);
      $q.notify({
        color: 'negative',
        message: `Failed to save article. ${ (error as Error).message || 'Please try again.'}`
      });
    } finally {
      isSaving.value = false;
    }
  };
  
  onMounted(() => {
     if (isEditMode.value) {
      fetchArticleForEdit();
    } else {
       // Reset for 'new' mode (though reactive default covers this)
       Object.assign(article, { title: '', category: '', content: [] });
     }
  });
  // --- Uploader Event Handlers ---

// Type the 'info' parameter for better DX
// info has structure { files: File[], xhr: XMLHttpRequest }
const onFileUploaded = (index: number, info: { files: File[], xhr: XMLHttpRequest }) => {
  try {
    const response = JSON.parse(info.xhr.responseText);
    const fileUrl = response?.url; // Access the URL from backend response

    if (fileUrl && article.content && article.content[index]?.type === 'FILE') {
        // Explicitly cast to FileItem if needed, or ensure type guard
        const fileItem = article.content[index] as FileItem;
        fileItem.url = fileUrl;

      // Optionally prefill link text with original file name if empty
      if (!fileItem.name && info.files.length > 0) {
        fileItem.name = info.files[0].name.split('.').slice(0, -1).join('.'); // Remove extension
      }

      $q.notify({
        color: 'positive',
        message: `File ${info.files[0].name} uploaded successfully. URL updated.`,
        icon: 'check',
      });

      // Optional: remove the file from uploader display after successful upload handled
      // This requires accessing the uploader instance via ref, which is tricky in v-for
      // Simpler to let the user remove it manually via the uploader's UI if needed.

    } else {
       console.error('Failed to parse URL from upload response or item type mismatch:', response);
       $q.notify({ color: 'negative', message: 'Error processing upload response.' });
    }
  } catch (e) {
    console.error('Error parsing upload response:', e, info.xhr.responseText);
    $q.notify({ color: 'negative', message: 'Failed to read server response after upload.' });
  }
};

const onUploadFailed = (info: { files: File[], xhr: XMLHttpRequest }) => {
    // Check for specific error messages from backend if available
    let errorMsg = 'File upload failed.';
    try {
        const response = JSON.parse(info.xhr.responseText);
        if (response?.message) {
            errorMsg = `File upload failed: ${response.message}`;
        }
    } catch (e) {
        // Ignore if response is not JSON
    }

    $q.notify({
        color: 'negative',
        message: errorMsg,
        icon: 'warning',
    });
};

// Optional: Function to clear URL if user removes file from uploader
const clearFileUrl = (index: number) => {
    if (article.content && article.content[index]?.type === 'FILE') {
        const fileItem = article.content[index] as FileItem;
        // Only clear if maybe it matches a filename pattern? Or just always clear?
        // Let's clear it. User can re-paste if needed.
        fileItem.url = '';
         $q.notify({
            color: 'info',
            message: 'File removed from uploader. URL cleared.',
            icon: 'info',
            position: 'top-right' // Avoid covering uploader
        });
    }
};

// NEW Handler for IMAGE upload
const onImageUploaded = (index: number, info: { files: File[], xhr: XMLHttpRequest }) => {
  try {
    const response = JSON.parse(info.xhr.responseText);
    const imageUrl = response?.url; // Get URL from backend response

    if (imageUrl && article.content && article.content[index]?.type === 'IMAGE') {
        // Cast to ImageItem for type safety
        const imageItem = article.content[index] as ImageItem;
        imageItem.src = imageUrl; // Update the 'src' field

      // We don't automatically fill alt text here, it should be descriptive
      // if (!imageItem.alt && info.files.length > 0) {
      //   imageItem.alt = info.files[0].name.split('.').slice(0, -1).join('.'); // Avoid doing this
      // }

      $q.notify({
        color: 'positive',
        message: `Image ${info.files[0].name} uploaded successfully. URL updated.`,
        icon: 'check',
      });

    } else {
       console.error('Failed to parse URL from upload response or item type mismatch for IMAGE:', response);
       $q.notify({ color: 'negative', message: 'Error processing image upload response.' });
    }
  } catch (e) {
    console.error('Error parsing image upload response:', e, info.xhr.responseText);
    $q.notify({ color: 'negative', message: 'Failed to read server response after image upload.' });
  }
};

// NEW Handler to clear IMAGE URL
const clearImageUrl = (index: number) => {
    if (article.content && article.content[index]?.type === 'IMAGE') {
        (article.content[index] as ImageItem).src = ''; // Clear the src field
         $q.notify({
            color: 'info', message: 'Image removed from uploader. URL cleared.', icon: 'info', position: 'top-right'
        });
    }
};
  </script>
  
  <style scoped>
  .text-h4 {
    margin-top: 0;
  }
  /* Add specific styles if needed */
  </style>
