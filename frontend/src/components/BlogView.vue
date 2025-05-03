<template>
  <div class="blog-container">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>Loading articles...</p>
    </div>
    
    <!-- Error state -->
    <div v-else-if="error" class="error-message">
      <p>{{ error }}</p>
    </div>

    <!-- Conditional Rendering: Show List or Selected Article -->
    <div v-else>
      <!-- Articles list View (shown if no article is selected) -->
      <div v-if="!selectedArticle">
        <div v-if="articles.length > 0" class="articles-list">
          <div v-for="article in articles" :key="article.id" class="article-card">
            <div class="article-title">{{ article.title }}</div>
            <div class="article-date-under-title">{{ new Date(article.updatedAt).toLocaleDateString() }}</div>
            <div class="article-meta">
              <span class="article-category">{{ article.category }}</span>
            </div>
            <button
              class="read-button"
              @click="selectArticle(article)"
            >
              READ
            </button>
          </div>
        </div>
        <!-- No articles state -->
        <div v-else class="no-articles">
          <p>No articles found.</p>
        </div>
      </div>

      <!-- Selected Article View (shown if an article is selected) -->
      <div v-else>
        <div class="article-header">
          <button class="back-button" @click="selectedArticle = null">← Back to list</button>
          <h1 class="article-title">{{ selectedArticle.title }}</h1>
          <div class="article-meta">
            <span class="article-category">Category: {{ selectedArticle.category }}</span>
            <!-- Consider adding date here too if needed -->
          </div>
        </div>
        <div class="article-content">
          <div
            v-for="(item, index) in selectedArticle.content"
            :key="index"
            class="content-item"
          >
            <!-- Paragraph content -->
            <div v-if="item.type === 'PARAGRAPH'" class="paragraph" v-html="item.html"></div>

            <!-- File content -->
            <div v-else-if="item.type === 'FILE'" class="file">
              <span class="file-icon">📎</span>
              <a :href="item.url" target="_blank" rel="noopener noreferrer">{{ item.name }}</a>
            </div>

            <!-- Image content -->
            <div v-else-if="item.type === 'IMAGE'" class="image">
              <img :src="item.src" :alt="item.alt">
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { Article } from '../types/models';

const props = defineProps<{
  apiUrl: string
}>();

const articles = ref<Article[]>([]);
const selectedArticle = ref<Article | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

// Fetch articles from the provided API URL
const fetchArticles = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    const response = await fetch(props.apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch articles: ${response.status} ${response.statusText}`);
    }
    
    articles.value = await response.json();
  } catch (err) {
    console.error('Error fetching articles:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load articles';
  } finally {
    isLoading.value = false;
  }
};

// Select an article to view
const selectArticle = (article: Article) => {
  selectedArticle.value = article;
};

// Watch for changes to the API URL and refetch when it changes
watch(() => props.apiUrl, () => {
  fetchArticles();
});

// Fetch articles when the component is mounted
onMounted(() => {
  fetchArticles();
});
</script>

<style scoped>
/* Container styles */
.blog-container {
  font-family: Arial, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  color: #333;
}

/* Loading state */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 4px solid #3498db;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Error message */
.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 15px;
  border-radius: 4px;
  margin: 20px 0;
}

/* Articles list */
.articles-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.article-card {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 20px;
  transition: box-shadow 0.3s ease;
  display: flex;
  flex-direction: column;
}

.article-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.article-title {
  margin-top: 0;
  margin-bottom: 3px;
  font-size: 1.25rem;
  color: #333;
}

.article-meta {
  margin-bottom: 15px;
  font-size: 0.9rem;
  color: #666;
  display: flex; /* Align category and potential future meta items */
  justify-content: space-between; /* Example alignment */
  align-items: center;
}

.article-date-under-title {
  font-size: 0.85rem;
  color: #888;
  margin-bottom: 10px; /* Space below the date */
}

.article-category {
  background-color: #f5f5f5;
  padding: 3px 8px;
  border-radius: 12px;
  display: inline-block;
}

.read-button {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  margin-top: auto;
  transition: background-color 0.2s ease;
}

.read-button:hover {
  background-color: #2980b9;
}

/* No articles state */
.no-articles {
  background-color: #f5f5f5;
  padding: 30px;
  text-align: center;
  border-radius: 4px;
  margin: 20px 0;
}

/* Selected Article View Styles */
.article-header {
  margin-bottom: 30px;
  border-bottom: 1px solid #eee; /* Optional separator */
  padding-bottom: 20px; /* Optional spacing */
}

.back-button {
  background: none;
  border: none;
  color: #3498db;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  margin-bottom: 20px;
  display: inline-block;
}

.back-button:hover {
  text-decoration: underline;
}

.article-content {
  line-height: 1.6;
}

.content-item {
  margin-bottom: 20px;
}

.paragraph {
  margin-bottom: 15px;
}

.file {
  display: flex;
  align-items: center;
  background-color: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
}

.file-icon {
  margin-right: 10px;
}

.file a {
  color: #3498db;
  text-decoration: none;
}

.file a:hover {
  text-decoration: underline;
}

.image img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}
</style>
