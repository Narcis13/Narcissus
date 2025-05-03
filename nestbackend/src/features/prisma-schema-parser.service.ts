import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface PrismaProperty {
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  isId: boolean;
  isUnique: boolean;
  hasDefault: boolean;
  defaultValue?: any;
  isRelation: boolean;
  relationName?: string;
  relationFields?: string[];
  relationReferences?: string[];
  dbAttributes?: string[];
  isEnum: boolean; // Add this new property
}

interface PrismaModel {
  name: string;
  properties: PrismaProperty[];
}

interface PrismaEnum {
  name: string;
  values: string[];
}

@Injectable()
export class PrismaSchemaParserService {
  private schemaContent: string;
  private models: PrismaModel[] = [];
  private enums: PrismaEnum[] = [];

  constructor() {}

  /**
   * Loads and parses the schema.prisma file
   * @param schemaPath Path to the schema.prisma file
   */
  async parseSchema(schemaPath?: string): Promise<void> {
    // Default path if not provided
    const filePath = schemaPath || path.join(process.cwd(), 'prisma', 'schema.prisma');
    
    try {
      this.schemaContent = fs.readFileSync(filePath, 'utf8');
      this.parseContent();
    } catch (error) {
      throw new Error(`Failed to parse schema file: ${error.message}`);
    }
  }

  /**
   * Parses the content of the schema file to extract models and enums
   */
  private parseContent(): void {
    this.models = [];
    this.enums = [];

    // Extract enums first
    const enumRegex = /enum\s+(\w+)\s+{([^}]*)}/gs;
    let enumMatch;
    while ((enumMatch = enumRegex.exec(this.schemaContent)) !== null) {
      const enumName = enumMatch[1];
      const enumBody = enumMatch[2];
      
      const values = enumBody
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('//'));
      
      this.enums.push({
        name: enumName,
        values,
      });
    }

    // Then extract models
    const modelRegex = /model\s+(\w+)\s+{([^}]*)}/gs;
    let modelMatch;
    while ((modelMatch = modelRegex.exec(this.schemaContent)) !== null) {
      const modelName = modelMatch[1];
      const modelBody = modelMatch[2];
      
      const properties = this.parseModelProperties(modelBody);
      
      this.models.push({
        name: modelName,
        properties,
      });
    }
  }

  /**
   * Parses the properties of a model
   * @param modelBody The body content of a model definition
   * @returns Array of parsed properties
   */
  private parseModelProperties(modelBody: string): PrismaProperty[] {
    const properties: PrismaProperty[] = [];
    const lines = modelBody.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    for (const line of lines) {
      // Skip lines that don't define properties (like comments)
      if (line.startsWith('//') || line.startsWith('@@')) continue;
      
      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;

      const [name, type, ...modifiers] = parts;
      
      // Remove any array brackets for type checking
      const baseType = type.replace('[]', '');
      
      // Basic property info
      const property: PrismaProperty = {
        name,
        type,
        isRequired: !line.includes('?'),
        isList: line.includes('[]'),
        isId: modifiers.includes('@id'),
        isUnique: modifiers.includes('@unique'),
        hasDefault: line.includes('@default'),
        isRelation: false,
        isEnum: this.isEnum(baseType), // Check if type is an enum
      };

      // Extract default value if present
      if (property.hasDefault) {
        const defaultMatch = line.match(/@default\(([^)]*)\)/);
        if (defaultMatch) {
          property.defaultValue = defaultMatch[1];
        }
      }

      // Check if it's a relation
      if (line.includes('@relation')) {
        property.isRelation = true;
        
        // Extract relation fields and references
        const relationMatch = line.match(/@relation\(([^)]*)\)/);
        if (relationMatch) {
          const relationContent = relationMatch[1];
          
          // Extract field names
          const fieldsMatch = relationContent.match(/fields:\s*\[(.*?)\]/);
          if (fieldsMatch) {
            property.relationFields = fieldsMatch[1]
              .split(',')
              .map(f => f.trim().replace(/"/g, ''));
          }
          
          // Extract reference fields
          const referencesMatch = relationContent.match(/references:\s*\[(.*?)\]/);
          if (referencesMatch) {
            property.relationReferences = referencesMatch[1]
              .split(',')
              .map(f => f.trim().replace(/"/g, ''));
          }
          
          // Extract relation name if present
          const nameMatch = relationContent.match(/name:\s*"([^"]*)"/);
          if (nameMatch) {
            property.relationName = nameMatch[1];
          }
        }
      }

      // Extract DB-specific attributes
      const dbMatch = line.match(/@db\.([^(\s)]*)(\([^)]*\))?/);
      if (dbMatch) {
        property.dbAttributes = [dbMatch[0]];
      }

      properties.push(property);
    }

    return properties;
  }

  /**
   * Gets all parsed models
   * @returns Array of parsed models
   */
  getModels(): PrismaModel[] {
    return this.models;
  }

  /**
   * Gets a specific model by name
   * @param modelName Name of the model to retrieve
   * @returns The model or undefined if not found
   */
  getModelByName(modelName: string): PrismaModel | undefined {
    return this.models.find(model => model.name === modelName);
  }

  /**
   * Gets all parsed enums
   * @returns Array of parsed enums
   */
  getEnums(): PrismaEnum[] {
    return this.enums;
  }

  /**
   * Gets a specific enum by name
   * @param enumName Name of the enum to retrieve
   * @returns The enum or undefined if not found
   */
  getEnumByName(enumName: string): PrismaEnum | undefined {
    return this.enums.find(enum_ => enum_.name === enumName);
  }

  /**
   * Checks if a given type is an enum
   * @param typeName Name of the type to check
   * @returns Boolean indicating if the type is an enum
   */
  isEnum(typeName: string): boolean {
    return this.enums.some(enum_ => enum_.name === typeName);
  }
}