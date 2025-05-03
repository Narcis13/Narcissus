# IonJianu StaffHUB - Technical Specification Document

## 1. Introduction

This document provides a comprehensive technical overview of the IonJianu StaffHUB application. It details the architecture, components, modules, and data flow for both the frontend (built with Quasar 2/Vue 3) and the backend (built with NestJS/Prisma). The primary purpose is to serve as a reference for understanding the current implementation and guiding future development, particularly when using AI prompts for feature extension.

## 2. High-Level Architecture

The application follows a standard client-server architecture:

*   **Frontend (Client):** A Single Page Application (SPA) built with Quasar 2 (Vue 3). It handles user interface, user interactions, and communicates with the backend via REST API calls.
*   **Backend (Server):** A RESTful API built with NestJS. It handles business logic, data validation, authentication, and interacts with the database via Prisma ORM.
*   **Database:** A MySQL database managed by Prisma ORM.
Use code with caution.
Markdown
+-----------------+ +----------------------+ +-------------------+
| Frontend | ---- | Backend API (NestJS) | ---- | Database (MySQL) |
| (Quasar/Vue 3) | HTTP | | | (via Prisma) |
+-----------------+ +----------------------+ +-------------------+

UI Components - Controllers - Tables (Models)

Pages - Services - Relations

Routing - Modules - Enums

State (Pinia) - Auth (JWT)

API Services - DTOs
- Prisma Client
- Shared Services
## 3. Frontend (Quasar 2 / Vue 3)

The frontend provides the user interface and manages client-side logic.

**3.1. Technology Stack**

*   Framework: Quasar v2 (using Vue 3)
*   Language: TypeScript, JavaScript
*   Component API: Vue 3 Composition API (`<script setup>`)
*   State Management: Pinia (`stores/useUtilizatorStores.ts`)
*   API Communication: Axios (configured in `boot/axios`, used via services)
*   Routing: Vue Router (configured in `src/router/`)
*   UI Library: Quasar Components
*   Styling: Quasar default styling, scoped CSS within components.

**3.2. Project Structure (`frontend/src`)**

*   `App.vue`: Root Vue component.
*   `boot/`: Quasar boot files (e.g., `axios.ts` for Axios configuration).
*   `components/`: Reusable Vue components.
*   `config/`: Application configuration (e.g., `api.js`).
*   `css/`: Global CSS files.
*   `layouts/`: Application layout components (e.g., `MainLayout.vue`).
*   `pages/`: Page-level components mapped to routes.
*   `router/`: Vue Router configuration (`routes.js`, `index.js`).
*   `services/`: Typed services for interacting with specific backend API endpoints.
*   `stores/`: Pinia state management stores (e.g., `useUtilizatorStores.ts`).
*   `types/`: TypeScript type definitions (e.g., `models.ts`).

**3.3. Core Components (`src/components`)**

*   **`DynamicCrud.vue`**:
    *   **Purpose:** A powerful, reusable component for generating a complete CRUD interface (data table, search, add/edit form dialog, delete confirmation) dynamically based on backend model metadata.
    *   **Features:** Fetches model metadata (`/features/prisma/models/:modelName`), enum options (`/features/prisma/modelenums`), and relation options (e.g., `/structure-attributes/structure`) from the backend. Dynamically renders table columns and form fields based on metadata, handling various data types (String, Int, Boolean, DateTime, Enums, Relations via QSelect). Uses Pinia store (`useUtilizatorStore`) for authentication tokens on write/delete operations.
    *   **Usage:** Instantiated in pages like `AtributeStructuri.vue`, `AtributePersoane.vue`, configured via props (`modelName`, `apiBasePath`, `excludeFields`, etc.).
*   **`ModelCrudTable.vue`**:
    *   **Purpose:** Similar to `DynamicCrud.vue`, creates a CRUD table and form dialog based on model metadata. Appears potentially simpler or an earlier version compared to `DynamicCrud`.
    *   **Features:** Fetches metadata (`/features/models/:modelName`), renders table and form. Handles basic types (varchar, number, boolean). Uses Pinia store for auth token.
    *   **Usage:** Used specifically by `Structuri.vue` and `Person.vue`. Fetches slightly different metadata endpoint than `DynamicCrud`.
*   **`BlogView.vue`**:
    *   **Purpose:** Displays a list of articles (as cards) or a single selected article's content.
    *   **Features:** Fetches articles from a given `apiUrl`. Handles loading and error states. Renders article list and detail views. Renders `ContentItem` types (PARAGRAPH, FILE, IMAGE) appropriately, using `v-html` for paragraphs.
    *   **Usage:** Used in `ArticleListPage.vue` for the preview tab.
*   **`DrawerTabs.vue`**:
    *   **Purpose:** Manages the content within the main layout's drawer, specifically the Login tab and the User Profile tab.
    *   **Features:** Contains a login form (`QForm`), handles authentication via `/auth/login`, updates the Pinia store (`useUtilizatorStore`), displays user info from the store, and provides a logout function. Switches between tabs based on authentication status.
*   **`Meniu.vue`**:
    *   **Purpose:** Displays the main application navigation menu within the drawer for authenticated users.
    *   **Features:** Uses Quasar `QExpansionItem` for collapsible sections (Administrare, Schema, Rapoarte). Contains `QItem` links (`to="/..."`) navigating to different application pages.
*   **`EssentialLink.vue`**:
    *   **Purpose:** Simple presentational component for displaying individual links (typically external or less critical) in the drawer.

**3.4. Key Pages (`src/pages`)**

*   `MainLayout.vue` (Layout): Defines the main application structure (header, drawer, page container). Integrates `DrawerTabs`, `Meniu`, and `EssentialLink`. Uses `useUtilizatorStore` to conditionally display the `Meniu`.
*   `IndexPage.vue`: Default landing page.
*   `ArticleListPage.vue`: Manages articles. Features a tabbed interface ("Design" with a `QTable` for CRUD operations, "Preview" using `BlogView`). Links to create, view, edit articles. Handles deletion with confirmation. Uses `ArticleService`.
*   `ArticleEditPage.vue`: Form for creating and editing articles. Uses `QForm`, `QInput`, `QEditor` (for PARAGRAPH), `QUploader` (for FILE and IMAGE types). Manages `ContentItem` array (add, remove, reorder). Interacts with `/upload/single` backend endpoint for file uploads and uses `ArticleService` for saving.
*   `ArticleViewPage.vue`: Displays a single published article. Fetches data using `ArticleService` and renders `ContentItem`s.
*   `CategoriesPage.vue`: Manages Categories and their associated List items. Features filtering, create/edit/view dialogs for both Categories and Lists. Uses `QTable` for both levels, `CategoryService`. *Note: Pagination seems intended but QTable `:pagination` binding and `@request` handler appear incomplete.*
*   `AtributeStructuri.vue`, `AtributePersoane.vue`: Utilize `DynamicCrud.vue` to provide interfaces for managing `StructureAttributes` and `PersonAttributes` respectively. Require authentication.
*   `Structuri.vue`, `Person.vue`: Utilize `ModelCrudTable.vue` to provide interfaces for managing `Structure` and `Person` entities respectively. Require authentication.
*   `Utilizatori.vue`: Currently a placeholder page.
*   `ErrorNotFound.vue`: Standard 404 page.

**3.5. Services (`src/services`)**

*   **`ArticleService.ts`**: Provides typed methods for CRUD operations on Articles (`/articles` endpoint). Handles formatting data (especially `content` relations) for Prisma create/update operations. Uses Axios instance and `useUtilizatorStore` for auth tokens.
*   **`CategoryService.ts`**: Provides typed methods for CRUD operations on Categories (`/categories`) and Lists (`/categories/:id/lists`, `/categories/lists/:id`). Handles filtering and pagination parameters. Uses Axios instance and `useUtilizatorStore` for auth tokens.

**3.6. State Management (`src/stores/useUtilizatorStores.ts`)**

*   **Purpose:** A Pinia store to manage global user authentication state.
*   **State:** Stores user profile information and the JWT `access_token`.
*   **Actions:** `autentificare` (stores login response), `logout` (clears state).
*   **Getters:** `eAutentificat` (checks if a token exists).
*   **Usage:** Used by `DrawerTabs` for login/logout, `MainLayout` to control menu visibility, and API services (`ArticleService`, `CategoryService`) and CRUD components (`DynamicCrud`, `ModelCrudTable`) to retrieve the auth token for protected requests.

**3.7. Routing (`src/router`)**

*   Uses Vue Router, configured in `routes.js`.
*   Defines paths for all pages, including parameterized routes for viewing/editing specific resources (e.g., `/articles/:id`, `/articles/:id/edit`).
*   Uses lazy loading (`import()`) for page components.
*   Includes a catch-all route (`/:catchAll(.*)*`) for 404 errors.

## 4. Backend (NestJS)

The backend provides the REST API, handles business logic, and interacts with the database.

**4.1. Technology Stack**

*   Framework: NestJS
*   Language: TypeScript
*   Database ORM: Prisma
*   Authentication: Passport.js (`passport-local`, `passport-jwt`), `@nestjs/passport`, `@nestjs/jwt`
*   Data Validation: `class-validator`, `class-transformer` (in DTOs)
*   File Uploads: `@nestjs/platform-express`, `multer`
*   Email: `nodemailer`
*   Configuration: `@nestjs/config` (implicitly for `.env` variables)
*   Scheduling: `@nestjs/schedule` (example Cron job in `UsersService`)

**4.2. Project Structure (`nestbackend/src`)**

*   `auth/`: Authentication logic (strategies, guards, module, service, controller).
*   `database/`: Prisma client configuration (`DatabaseService`, `DatabaseModule`).
*   `email/`: Email sending functionality.
*   `features/`: Service and controller for exposing Prisma schema metadata.
*   `file-upload/`: File upload handling module.
*   `product/`: Example CRUD module (likely).
*   `schema/`: Contains modules for each core data model (e.g., `articles`, `categories`, `structure`). Each typically includes `controller`, `service`, `module`, and `dto` subfolder.
*   `shared/`: Common services or utilities (e.g., `FilteringService`).
*   `users/`: User management logic.
*   `utils/`: Utility functions (e.g., `timezone.ts`).
*   `app.module.ts`: Root application module.
*   `main.ts`: Application entry point and bootstrap configuration.
*   `schema.prisma`: Prisma schema definition file.

**4.3. Core Modules & Services**

*   **`AuthModule` (`src/auth`)**:
    *   **Purpose:** Handles user authentication (login) and protects routes.
    *   **Components:** `LocalStrategy`, `JwtStrategy`, `LocalAuthGuard`, `JwtAuthGuard`, `AuthService`, `AuthController`.
    *   **Flow:** `AuthController` (`/auth/login`) uses `LocalAuthGuard` -> `LocalStrategy` -> `AuthService.validateUser`. On success, `AuthService.login` generates a JWT. Subsequent requests use `JwtAuthGuard` -> `JwtStrategy` to validate the token.
    *   **Note:** JWT Secret is currently hardcoded in `JwtStrategy` and `AuthModule`. Should use `ConfigService` and `.env`.
*   **`DatabaseModule` (`src/database`)**:
    *   **Purpose:** Provides the configured Prisma client (`DatabaseService`) globally.
    *   **Components:** `DatabaseService` (extends `PrismaClient`).
*   **`FeaturesModule` (`src/features`)**:
    *   **Purpose:** Exposes information about the Prisma schema models and enums to the frontend, primarily for `DynamicCrud.vue`.
    *   **Components:** `FeaturesController`, `FeaturesService`, `PrismaSchemaParserService`.
    *   **`PrismaSchemaParserService`:** Reads and parses `schema.prisma` on startup to understand model structures, field types, relations, enums, attributes (`@id`, `@unique`, `@default`, `@relation`, etc.).
    *   **`FeaturesService`:** Uses the parser service to provide model/enum data via the controller. Also contains older logic to get metadata via SQL `INFORMATION_SCHEMA`.
*   **`FileUploadModule` (`src/file-upload`)**:
    *   **Purpose:** Handles uploading and deleting files.
    *   **Components:** `FileUploadController`, `FileUploadService`, `MulterModule` configuration.
    *   **Flow:** Controller uses `FileInterceptor`/`FilesInterceptor`. `MulterModule` config saves files to disk (`./public/incarcari`) with unique names. `FileUploadService` provides helpers for deletion and URL generation. Static file serving configured in `main.ts`.
    *   **Note:** Discrepancy in file paths used in service delete vs. multer config/static serve needs fixing in `FileUploadService.deleteFile`.
*   **`SharedModule` (`src/shared` - Implicitly, via `FilteringService`)**:
    *   **Purpose:** Contains reusable services across different schema modules.
    *   **`FilteringService` (`src/shared/services/filtering.service.ts`):** A crucial generic service for building Prisma query clauses (`where`, `orderBy`, `skip`, `take`) based on filter DTOs and configuration maps provided by calling services (e.g., `CategoriesService`, `StructureAttributesService`). Promotes DRY principle for filtering/sorting/pagination logic.
*   **Schema Modules (`src/schema/*`)**:
    *   **Purpose:** Each module encapsulates the CRUD logic, DTOs, controller, and service for a specific Prisma model (e.g., `Articles`, `Categories`, `Structure`, `Person`, etc.).
    *   **Pattern:** Typically include:
        *   `*.controller.ts`: Defines API routes, uses Guards, Pipes (e.g., `ParseIntPipe`), DTOs for request/response validation.
        *   `*.service.ts`: Contains business logic, interacts with `DatabaseService` (Prisma) and often `FilteringService`.
        *   `*.module.ts`: Declares the controller and service, imports necessary modules.
        *   `dto/`: Folder containing Data Transfer Objects (`Create*Dto`, `Update*Dto`, `Filter*Dto`) using `class-validator`.

**4.4. Authentication & Authorization**

*   Uses JWT (JSON Web Tokens) for stateless authentication.
*   Login (`/auth/login`) requires username/password, returns `access_token`.
*   Protected routes are decorated with `@UseGuards(AuthGuard('jwt'))` or `@UseGuards(JwtAuthGuard)`.
*   The `JwtStrategy` validates the token sent in the `Authorization: Bearer <token>` header.
*   No explicit role-based authorization is implemented in the provided code.

**4.5. Database (Prisma)**

*   **ORM:** Prisma Client is used for database interaction.
*   **Schema (`schema.prisma`):** Defines database models, relations, and enums.
    *   **Models (based on code usage):** `User`, `Structure`, `StructureAttributes`, `Person`, `PersonAttributes`, `Article`, `ContentItem`, `Category`, `List`. (Note: The provided `schema.prisma` file content is incomplete/outdated compared to the application code).
    *   **Enums (identified):** `Datatypes`, `ContentItemType`, `ListStatus`, `CategoryStatus`. (Note: `Availibility` is in the provided schema but not seen used in controllers/services).
    *   **Relations:** Defined between models (e.g., `Structure` <-> `StructureAttributes`, `Person` <-> `PersonAttributes`, `Article` <-> `ContentItem`, `Category` <-> `List`).
*   **Migrations:** Prisma Migrate should be used for schema changes (not shown, but standard practice).
*   **Service:** `DatabaseService` provides the Prisma Client instance.

## 5. Key Interactions & Data Flow

*   **Login:** FE (`DrawerTabs.vue`) -> POST `/auth/login` -> BE (`AuthController` -> `LocalAuthGuard` -> `AuthService`) -> `UsersService.findByUsername` -> Compare hash -> Generate JWT -> Return token/profile -> FE stores token/profile in Pinia (`useUtilizatorStore`).
*   **Authenticated Request:** FE (Service/Component) -> Get token from Pinia -> Add `Authorization: Bearer <token>` header -> Send request -> BE (Controller with `@UseGuards(JwtAuthGuard)`) -> `JwtAuthGuard` -> `JwtStrategy` validates token -> Controller/Service executes logic.
*   **Dynamic CRUD (`DynamicCrud.vue`):**
    1.  FE (`DynamicCrud.vue` on mount) -> GET `/features/prisma/models/:modelName` -> BE (`FeaturesController` -> `FeaturesService` -> `PrismaSchemaParserService`) -> Return metadata.
    2.  FE -> GET `/features/prisma/modelenums` (if needed) -> Return enum values.
    3.  FE -> GET `/apiBasePath/:relationModelName` (for each relation field) -> Return relation options (e.g., list of Structures).
    4.  FE -> Renders table columns and form fields based on metadata.
    5.  FE (Table load) -> GET `/apiBasePath` (e.g., `/structure-attributes`) -> BE (e.g., `StructureAttributesController.findAll`) -> `StructureAttributesService.findAll` -> `FilteringService` -> `DatabaseService` -> Return data.
    6.  FE (Save) -> POST/PATCH `/apiBasePath(/id)` -> BE (e.g., `StructureAttributesController.create/update`) -> `StructureAttributesService` -> `DatabaseService` -> Return result.
*   **Article Creation/Update:** FE (`ArticleEditPage.vue`) -> Uploads files via `QUploader` -> POST `/upload/single` -> BE (`FileUploadController`) saves file -> Returns URL -> FE updates `FileItem`/`ImageItem` URL -> User clicks Save -> FE (`ArticleService.create/update`) -> Formats `content` array into Prisma `create` structure -> POST/PATCH `/articles(/id)` -> BE (`ArticlesController` -> `ArticlesService`) -> `DatabaseService` (handles nested create/deleteMany for content) -> Return result.
*   **Category/List Management:** FE (`CategoriesPage.vue`) -> GET `/categories` (with filters) -> BE (`CategoriesController.findAllCategories`) -> `CategoriesService.findAllCategories` -> `FilteringService` -> `DatabaseService` -> Return paginated categories with counts -> FE displays categories -> User clicks View -> Dialog opens -> GET `/categories/:id/lists` (with filters) -> BE (`CategoriesController.findAllListsForCategory`) -> `CategoriesService.findAllListsForCategory` -> `FilteringService` -> `DatabaseService` -> Return paginated lists -> FE displays lists. Similar flows for create/update/delete dialogs.

## 6. Observations & Recommendations

*   **JWT Secret:** The JWT secret should be loaded from environment variables via `ConfigService` instead of being hardcoded in `auth.module.ts` and `jwt.strategy.ts`.
*   **File Paths:** The file path used in `FileUploadService.deleteFile` (`./incarcari/`) seems inconsistent with the `MulterModule` destination (`./public/incarcari`) and static serving root (`public`). Ensure consistency, likely using `./public/incarcari/`.
*   **Frontend Pagination:** The `CategoriesPage.vue` implements filtering UI but the `QTable` pagination binding (`:pagination.sync` or `@request` handler) seems incomplete or missing, potentially leading to client-side pagination/sorting only, despite backend support. Review and implement server-side pagination/sorting fully using the `@request` prop on `QTable`.
*   **Prisma Schema:** The provided `schema.prisma` file content is significantly outdated/incomplete compared to the models used throughout the backend code (missing Articles, Categories, Lists, Person, etc.). The actual schema file used by the application should be considered the source of truth.
*   **Error Handling:** Frontend error handling seems basic (`$q.notify`). Consider more robust strategies for different error types. Backend error handling uses standard NestJS exceptions.
*   **Code Duplication:** `DynamicCrud.vue` and `ModelCrudTable.vue` have overlapping functionality. Consider consolidating into `DynamicCrud.vue` if `ModelCrudTable.vue` doesn't offer unique necessary features. The different metadata endpoints they hit (`/features/prisma/models/` vs `/features/models/`) should also be unified.
*   **Type Safety:** While services are typed, ensure DTOs and component props/state consistently use TypeScript types.
*   **Environment Variables:** Ensure all sensitive or environment-specific configurations (DB URL, JWT Secret, SMTP details, Ports) are managed via `.env` files and `ConfigModule`.

## 7. Conclusion

The IonJianu StaffHUB application leverages the strengths of Quasar for the frontend and NestJS for the backend, using Prisma for database interactions. Key features include dynamic CRUD generation based on schema metadata, article management with rich content, category/list management, and JWT authentication. The shared `FilteringService` and `PrismaSchemaParserService` are crucial backend components. This document provides a solid foundation for understanding the existing system and planning future enhancements. Addressing the observations noted above will improve consistency and maintainability.