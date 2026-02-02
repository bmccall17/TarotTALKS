import { db } from '../index';
import { themes, cardThemes, talkThemes } from '../schema';
import { eq, sql, desc, ilike, or } from 'drizzle-orm';

// Type for creating/updating a theme
export type InsertTheme = typeof themes.$inferInsert;

/**
 * Get all themes for admin with card/talk counts
 */
export async function getAllThemesForAdmin(category?: string) {
  // Build where clause for category filter
  const whereClause = category ? eq(themes.category, category as 'emotion' | 'life_phase' | 'role' | 'other') : undefined;

  const allThemes = await db
    .select({
      id: themes.id,
      slug: themes.slug,
      name: themes.name,
      shortDescription: themes.shortDescription,
      longDescription: themes.longDescription,
      category: themes.category,
      createdAt: themes.createdAt,
      updatedAt: themes.updatedAt,
    })
    .from(themes)
    .where(whereClause)
    .orderBy(themes.name);

  // Get counts for each theme
  const themesWithCounts = await Promise.all(
    allThemes.map(async (theme) => {
      const [cardCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(cardThemes)
        .where(eq(cardThemes.themeId, theme.id));

      const [talkCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(talkThemes)
        .where(eq(talkThemes.themeId, theme.id));

      return {
        ...theme,
        cardsCount: Number(cardCount.count),
        talksCount: Number(talkCount.count),
      };
    })
  );

  return themesWithCounts;
}

/**
 * Get a single theme by ID for admin
 */
export async function getThemeByIdForAdmin(id: string) {
  const [theme] = await db
    .select()
    .from(themes)
    .where(eq(themes.id, id))
    .limit(1);

  if (!theme) return null;

  // Get counts
  const [cardCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(cardThemes)
    .where(eq(cardThemes.themeId, id));

  const [talkCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(talkThemes)
    .where(eq(talkThemes.themeId, id));

  return {
    ...theme,
    cardsCount: Number(cardCount.count),
    talksCount: Number(talkCount.count),
  };
}

/**
 * Create a new theme with slug collision handling
 */
export async function createTheme(data: Omit<InsertTheme, 'slug'> & { slug?: string }) {
  // Generate slug from name if not provided
  let slug = data.slug || generateSlug(data.name);

  // Check for existing slug and handle collision
  const existing = await db
    .select({ slug: themes.slug })
    .from(themes)
    .where(eq(themes.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    // Append timestamp to make unique
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const result = await db
    .insert(themes)
    .values({
      ...data,
      slug,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result[0];
}

/**
 * Update an existing theme
 */
export async function updateTheme(id: string, data: Partial<InsertTheme>) {
  const result = await db
    .update(themes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(themes.id, id))
    .returning();

  return result[0];
}

/**
 * Delete a theme (hard delete - cascade removes from cardThemes/talkThemes)
 */
export async function deleteTheme(id: string) {
  // Get theme info for audit log before deleting
  const theme = await db
    .select({ name: themes.name })
    .from(themes)
    .where(eq(themes.id, id))
    .limit(1);

  if (theme.length === 0) {
    throw new Error('Theme not found');
  }

  // Audit log
  console.log(
    `[AUDIT] ${new Date().toISOString()} | THEME_DELETED | ${JSON.stringify({
      themeId: id,
      themeName: theme[0].name,
    })}`
  );

  // Hard delete (CASCADE will delete related cardThemes/talkThemes)
  await db.delete(themes).where(eq(themes.id, id));

  return { success: true };
}

/**
 * Search themes by name or description
 */
export async function searchThemesForAdmin(query: string) {
  const searchPattern = `%${query}%`;

  const matchedThemes = await db
    .select({
      id: themes.id,
      slug: themes.slug,
      name: themes.name,
      shortDescription: themes.shortDescription,
      longDescription: themes.longDescription,
      category: themes.category,
      createdAt: themes.createdAt,
      updatedAt: themes.updatedAt,
    })
    .from(themes)
    .where(
      or(
        ilike(themes.name, searchPattern),
        ilike(themes.shortDescription, searchPattern)
      )
    )
    .orderBy(themes.name)
    .limit(50);

  // Get counts for each theme
  const themesWithCounts = await Promise.all(
    matchedThemes.map(async (theme) => {
      const [cardCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(cardThemes)
        .where(eq(cardThemes.themeId, theme.id));

      const [talkCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(talkThemes)
        .where(eq(talkThemes.themeId, theme.id));

      return {
        ...theme,
        cardsCount: Number(cardCount.count),
        talksCount: Number(talkCount.count),
      };
    })
  );

  return themesWithCounts;
}

/**
 * Get statistics for themes
 */
export async function getThemesStats() {
  const [total] = await db.select({ count: sql<number>`count(*)` }).from(themes);

  const categories = await db
    .select({
      category: themes.category,
      count: sql<number>`count(*)`,
    })
    .from(themes)
    .groupBy(themes.category);

  return {
    total: Number(total.count),
    byCategory: categories.reduce((acc, { category, count }) => {
      acc[category || 'uncategorized'] = Number(count);
      return acc;
    }, {} as Record<string, number>),
  };
}

// Helper function to generate slug
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
