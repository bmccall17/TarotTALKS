import { ThemesList } from '@/components/admin/themes/ThemesList';

export default function ThemesPage() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-100">Manage Themes</h1>
          <p className="text-gray-400 mt-2">
            Create, edit, and manage curated theme collections
          </p>
        </div>

        <ThemesList />
      </div>
    </div>
  );
}
