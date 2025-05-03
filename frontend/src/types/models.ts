
  
  export interface Article {
    id: number;
    title: string;
    category: string;
    updatedAt: string; // Added updatedAt property
    content: ContentItem[];
  }
  
  // For creating/editing, ID might not be present initially
  export type ArticleInput = Omit<Article, 'id'> & { id?: number };
// src/types/models.ts

// --- Existing Article Types ---
export interface ParagraphItem {
  type: 'PARAGRAPH';
  html: string;
  order?: number; // Add order
  id?: number; // Optional ID from DB
  articleId?: number; // Optional relation ID
}

export interface FileItem {
  type: 'FILE';
  url: string;
  name: string;
  order?: number; // Add order
  id?: number; // Optional ID from DB
  articleId?: number; // Optional relation ID
}

export interface ImageItem {
  type: 'IMAGE';
  src: string;
  alt: string;
  order?: number; // Add order
  id?: number; // Optional ID from DB
  articleId?: number; // Optional relation ID
}

// Union type for content items
export type ContentItem = ParagraphItem | FileItem | ImageItem;



// --- NEW Category & List Types ---

export interface Category {
  id: number;
  name: string;
  status?: string | null; // 'active' | 'inactive' or null if not set
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
  _count?: { // From include count
    lists?: number;
  };
  lists?: List[]; // Optional based on query
}

export interface List {
  id: number;
  item: string;
  status?: string | null; // 'active' | 'inactive' | 'completed' or null
  categoryId: number;
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
  category?: { // Included from Prisma query (optional)
    id: number;
    name: string;
  };
}

// DTOs for API interaction (align with backend DTOs)
export interface CreateCategoryDto {
  name: string;
  status?: string;
}
export type UpdateCategoryDto = Partial<CreateCategoryDto>;

export interface CreateListDto {
  item: string;
  status?: string;
}
export interface UpdateListDto extends Partial<CreateListDto> {
  categoryId?: number; // Allow changing category
}

// Filter DTOs (matching backend)
export interface FilterCategoryDto {
  name?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: 'id' | 'name' | 'status' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface FilterListDto {
  item?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: 'id' | 'item' | 'status' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// API Response Pagination Meta
export interface PaginationMeta {
  totalItems: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

// Generic Paginated Response structure
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}