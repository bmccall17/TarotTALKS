'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Image,
  Download,
  FileText,
  Map,
  Trash2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AtSign,
  Share2,
} from 'lucide-react';
import { IssueCard } from './IssueCard';
import { Toast } from '../ui/Toast';
import {
  QuickEditModal,
  RestoreConfirmModal,
  DuplicateYoutubeModal,
  SetPrimaryModal,
  FetchThumbnailModal,
  DownloadThumbnailModal,
  AddMappingModal,
} from './modals';

type ValidationIssues = {
  duplicateYoutubeIds: Array<{
    youtubeVideoId: string;
    talks: Array<{ id: string; title: string; speakerName: string; slug: string }>;
  }>;
  missingBothUrls: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    tedUrl?: string | null;
    youtubeUrl?: string | null;
    youtubeVideoId?: string | null;
    thumbnailUrl?: string | null;
  }>;
  missingThumbnails: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    tedUrl?: string | null;
    youtubeUrl?: string | null;
    youtubeVideoId?: string | null;
    thumbnailUrl?: string | null;
  }>;
  externalThumbnails: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    tedUrl?: string | null;
    youtubeUrl?: string | null;
    youtubeVideoId?: string | null;
    thumbnailUrl?: string | null;
  }>;
  shortDescriptions: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    description: string | null;
    tedUrl?: string | null;
    youtubeUrl?: string | null;
    youtubeVideoId?: string | null;
    thumbnailUrl?: string | null;
  }>;
  cardsWithoutPrimaryMapping: Array<{
    id: string;
    name: string;
    slug: string;
    imageUrl: string;
    mappingsCount: number;
  }>;
  talksNotMappedToAnyCard: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    thumbnailUrl: string | null;
    tedUrl?: string | null;
    youtubeUrl?: string | null;
    youtubeVideoId?: string | null;
  }>;
  mappingsMissingLongRationale: Array<{
    mappingId: string;
    cardId: string;
    cardName: string;
    cardSlug: string;
    cardImageUrl: string;
    talkId: string;
    talkTitle: string;
    talkSpeakerName: string;
    talkSlug: string;
    rationaleShort: string | null;
  }>;
  softDeletedTalks: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    deletedAt: Date | null;
    tedUrl?: string | null;
    youtubeUrl?: string | null;
    youtubeVideoId?: string | null;
    thumbnailUrl?: string | null;
  }>;
  missingSocialHandles: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    speakerTwitterHandle: string | null;
    speakerBlueskyHandle: string | null;
    tedUrl?: string | null;
    youtubeUrl?: string | null;
  }>;
  unpostedCards: Array<{
    id: string;
    name: string;
    slug: string;
    imageUrl: string;
    sequenceIndex: number;
  }>;
};

type Props = {
  initialIssues: ValidationIssues;
};

type SectionKey = keyof ValidationIssues;

type IssueType =
  | 'duplicateYoutube'
  | 'missingUrls'
  | 'missingThumbnail'
  | 'externalThumbnail'
  | 'shortDescription'
  | 'cardNoPrimary'
  | 'unmappedTalk'
  | 'missingLongRationale'
  | 'softDeleted'
  | 'missingSocialHandles'
  | 'unpostedCard';

export function ValidationDashboard({ initialIssues }: Props) {
  const [issues, setIssues] = useState<ValidationIssues>(initialIssues);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    duplicateYoutubeIds: true,
    missingBothUrls: true,
    missingThumbnails: false,
    externalThumbnails: true,
    shortDescriptions: false,
    cardsWithoutPrimaryMapping: true,
    talksNotMappedToAnyCard: false,
    mappingsMissingLongRationale: true,
    softDeletedTalks: false,
    missingSocialHandles: false,
    unpostedCards: true,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal state
  const [activeModal, setActiveModal] = useState<IssueType | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [fixedIssues, setFixedIssues] = useState<Set<string>>(new Set());
  const [fixingId, setFixingId] = useState<string | null>(null);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/validation');
      if (!res.ok) throw new Error('Failed to refresh');
      const data = await res.json();
      setIssues(data.issues);
      setToast({ message: 'Issues refreshed', type: 'success' });
    } catch (error) {
      console.error('Error refreshing:', error);
      setToast({ message: 'Failed to refresh issues', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleFix = (type: IssueType, data: any) => {
    setActiveModal(type);
    setSelectedIssue(data);
    setFixingId(data.id || data.youtubeVideoId || null);
  };

  const handleModalClose = () => {
    setActiveModal(null);
    setSelectedIssue(null);
    setFixingId(null);
  };

  const handleFixSuccess = async () => {
    // Add to fixed issues
    if (fixingId) {
      setFixedIssues(prev => new Set(prev).add(fixingId));
    }

    // Show success toast
    setToast({ message: 'Issue fixed successfully', type: 'success' });

    // Refresh issues after a short delay
    setTimeout(async () => {
      await handleRefresh();
      handleModalClose();
    }, 500);
  };

  const getIssueId = (type: IssueType, data: any): string => {
    if (type === 'duplicateYoutube') {
      return data.youtubeVideoId;
    }
    return data.id;
  };

  const sectionConfig: Record<
    SectionKey,
    { title: string; icon: React.ReactNode; severity: 'critical' | 'important' | 'mapping' | 'info' }
  > = {
    duplicateYoutubeIds: {
      title: 'Duplicate YouTube IDs',
      icon: <AlertTriangle className="w-5 h-5" />,
      severity: 'critical',
    },
    missingBothUrls: {
      title: 'Missing Both URLs',
      icon: <AlertCircle className="w-5 h-5" />,
      severity: 'critical',
    },
    missingThumbnails: {
      title: 'Missing Thumbnails',
      icon: <Image className="w-5 h-5" />,
      severity: 'important',
    },
    externalThumbnails: {
      title: 'External Thumbnails (Need Download)',
      icon: <Download className="w-5 h-5" />,
      severity: 'important',
    },
    shortDescriptions: {
      title: 'Short/Missing Descriptions',
      icon: <FileText className="w-5 h-5" />,
      severity: 'important',
    },
    cardsWithoutPrimaryMapping: {
      title: 'Cards Without Primary Mapping',
      icon: <Map className="w-5 h-5" />,
      severity: 'mapping',
    },
    talksNotMappedToAnyCard: {
      title: 'Unmapped Talks',
      icon: <Map className="w-5 h-5" />,
      severity: 'mapping',
    },
    mappingsMissingLongRationale: {
      title: 'Mappings Missing Long Rationale',
      icon: <FileText className="w-5 h-5" />,
      severity: 'mapping',
    },
    softDeletedTalks: {
      title: 'Soft-Deleted Talks',
      icon: <Trash2 className="w-5 h-5" />,
      severity: 'info',
    },
    missingSocialHandles: {
      title: 'Missing Social Handles (Tag Pack)',
      icon: <AtSign className="w-5 h-5" />,
      severity: 'info',
    },
    unpostedCards: {
      title: 'Cards Not Yet Shared',
      icon: <Share2 className="w-5 h-5" />,
      severity: 'info',
    },
  };

  const severityColors = {
    critical: 'border-red-500/30 text-red-400',
    important: 'border-yellow-500/30 text-yellow-400',
    mapping: 'border-orange-500/30 text-orange-400',
    info: 'border-blue-500/30 text-blue-400',
  };

  const renderSection = (key: SectionKey) => {
    const config = sectionConfig[key];
    const items = issues[key];
    const isExpanded = expandedSections[key];
    const count = Array.isArray(items) ? items.length : 0;

    if (count === 0) return null;

    const Icon = isExpanded ? ChevronDown : ChevronRight;

    return (
      <div
        key={key}
        className={`bg-gray-800/50 border ${severityColors[config.severity].split(' ')[0]} rounded-xl overflow-hidden`}
      >
        {/* Section Header */}
        <button
          onClick={() => toggleSection(key)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-700/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className={severityColors[config.severity].split(' ')[1]}>
              {config.icon}
            </span>
            <span className="font-medium text-gray-100">{config.title}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${severityColors[config.severity]}`}>
              {count}
            </span>
          </div>
          <Icon className="w-5 h-5 text-gray-400" />
        </button>

        {/* Section Content */}
        {isExpanded && (
          <div className="border-t border-gray-700 p-4 space-y-3">
            {key === 'duplicateYoutubeIds' &&
              issues.duplicateYoutubeIds.map((item) => {
                const issueId = getIssueId('duplicateYoutube', item);
                return (
                  <IssueCard
                    key={item.youtubeVideoId}
                    type="duplicateYoutube"
                    data={item}
                    onFix={handleFix}
                    isFixed={fixedIssues.has(issueId)}
                    isFixing={fixingId === issueId}
                  />
                );
              })}

            {key === 'missingBothUrls' &&
              issues.missingBothUrls.map((item) => {
                const issueId = getIssueId('missingUrls', item);
                return (
                  <IssueCard
                    key={item.id}
                    type="missingUrls"
                    data={item}
                    onFix={handleFix}
                    isFixed={fixedIssues.has(issueId)}
                    isFixing={fixingId === issueId}
                  />
                );
              })}

            {key === 'missingThumbnails' &&
              issues.missingThumbnails.map((item) => {
                const issueId = getIssueId('missingThumbnail', item);
                return (
                  <IssueCard
                    key={item.id}
                    type="missingThumbnail"
                    data={item}
                    onFix={handleFix}
                    isFixed={fixedIssues.has(issueId)}
                    isFixing={fixingId === issueId}
                  />
                );
              })}

            {key === 'externalThumbnails' &&
              issues.externalThumbnails.map((item) => {
                const issueId = getIssueId('externalThumbnail', item);
                return (
                  <IssueCard
                    key={item.id}
                    type="externalThumbnail"
                    data={item}
                    onFix={handleFix}
                    isFixed={fixedIssues.has(issueId)}
                    isFixing={fixingId === issueId}
                  />
                );
              })}

            {key === 'shortDescriptions' &&
              issues.shortDescriptions.map((item) => {
                const issueId = getIssueId('shortDescription', item);
                return (
                  <IssueCard
                    key={item.id}
                    type="shortDescription"
                    data={item}
                    onFix={handleFix}
                    isFixed={fixedIssues.has(issueId)}
                    isFixing={fixingId === issueId}
                  />
                );
              })}

            {key === 'cardsWithoutPrimaryMapping' &&
              issues.cardsWithoutPrimaryMapping.map((item) => {
                const issueId = getIssueId('cardNoPrimary', item);
                return (
                  <IssueCard
                    key={item.id}
                    type="cardNoPrimary"
                    data={item}
                    onFix={handleFix}
                    isFixed={fixedIssues.has(issueId)}
                    isFixing={fixingId === issueId}
                  />
                );
              })}

            {key === 'talksNotMappedToAnyCard' &&
              issues.talksNotMappedToAnyCard.map((item) => {
                const issueId = getIssueId('unmappedTalk', item);
                return (
                  <IssueCard
                    key={item.id}
                    type="unmappedTalk"
                    data={item}
                    onFix={handleFix}
                    isFixed={fixedIssues.has(issueId)}
                    isFixing={fixingId === issueId}
                  />
                );
              })}

            {key === 'mappingsMissingLongRationale' &&
              issues.mappingsMissingLongRationale.map((item) => {
                const issueId = item.mappingId;
                return (
                  <IssueCard
                    key={item.mappingId}
                    type="missingLongRationale"
                    data={item}
                    onFix={handleFix}
                    isFixed={fixedIssues.has(issueId)}
                    isFixing={fixingId === issueId}
                  />
                );
              })}

            {key === 'softDeletedTalks' &&
              issues.softDeletedTalks.map((item) => {
                const issueId = getIssueId('softDeleted', item);
                return (
                  <IssueCard
                    key={item.id}
                    type="softDeleted"
                    data={item}
                    onFix={handleFix}
                    isFixed={fixedIssues.has(issueId)}
                    isFixing={fixingId === issueId}
                  />
                );
              })}

            {key === 'missingSocialHandles' &&
              issues.missingSocialHandles.map((item) => {
                const issueId = getIssueId('missingSocialHandles', item);
                return (
                  <IssueCard
                    key={item.id}
                    type="missingSocialHandles"
                    data={item}
                    onFix={handleFix}
                    isFixed={fixedIssues.has(issueId)}
                    isFixing={fixingId === issueId}
                  />
                );
              })}

            {key === 'unpostedCards' &&
              issues.unpostedCards.map((item) => {
                const issueId = item.id;
                return (
                  <IssueCard
                    key={item.id}
                    type="unpostedCard"
                    data={item}
                    onFix={handleFix}
                    isFixed={fixedIssues.has(issueId)}
                    isFixing={fixingId === issueId}
                  />
                );
              })}
          </div>
        )}
      </div>
    );
  };

  const totalIssues = Object.values(issues).reduce(
    (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <p className="text-gray-400">
          {totalIssues === 0
            ? 'No issues found - your data is clean!'
            : `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} found`}
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Issue Sections */}
      {totalIssues === 0 ? (
        <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-8 text-center">
          <p className="text-green-400 text-lg font-medium">All Clear!</p>
          <p className="text-gray-400 mt-2">
            No data quality issues detected in your content.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Critical Issues */}
          {(issues.duplicateYoutubeIds.length > 0 || issues.missingBothUrls.length > 0) && (
            <div>
              <h2 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Critical Issues
              </h2>
              <div className="space-y-4">
                {renderSection('duplicateYoutubeIds')}
                {renderSection('missingBothUrls')}
              </div>
            </div>
          )}

          {/* Important Issues */}
          {(issues.missingThumbnails.length > 0 ||
            issues.externalThumbnails.length > 0 ||
            issues.shortDescriptions.length > 0) && (
            <div>
              <h2 className="text-sm font-medium text-yellow-400 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Important Issues
              </h2>
              <div className="space-y-4">
                {renderSection('missingThumbnails')}
                {renderSection('externalThumbnails')}
                {renderSection('shortDescriptions')}
              </div>
            </div>
          )}

          {/* Mapping Issues */}
          {(issues.cardsWithoutPrimaryMapping.length > 0 ||
            issues.talksNotMappedToAnyCard.length > 0 ||
            issues.mappingsMissingLongRationale.length > 0) && (
            <div>
              <h2 className="text-sm font-medium text-orange-400 mb-3 flex items-center gap-2">
                <Map className="w-4 h-4" />
                Mapping Issues
              </h2>
              <div className="space-y-4">
                {renderSection('cardsWithoutPrimaryMapping')}
                {renderSection('talksNotMappedToAnyCard')}
                {renderSection('mappingsMissingLongRationale')}
              </div>
            </div>
          )}

          {/* Info Items */}
          {(issues.softDeletedTalks.length > 0 || issues.missingSocialHandles.length > 0 || issues.unpostedCards.length > 0) && (
            <div>
              <h2 className="text-sm font-medium text-blue-400 mb-3 flex items-center gap-2">
                <AtSign className="w-4 h-4" />
                Info Items
              </h2>
              <div className="space-y-4">
                {renderSection('softDeletedTalks')}
                {renderSection('missingSocialHandles')}
                {renderSection('unpostedCards')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Modals */}
      {activeModal === 'duplicateYoutube' && selectedIssue && (
        <DuplicateYoutubeModal
          youtubeVideoId={selectedIssue.youtubeVideoId}
          talks={selectedIssue.talks}
          onClose={handleModalClose}
          onSuccess={handleFixSuccess}
        />
      )}

      {activeModal === 'softDeleted' && selectedIssue && (
        <RestoreConfirmModal
          talk={selectedIssue}
          onClose={handleModalClose}
          onSuccess={handleFixSuccess}
        />
      )}


      {activeModal === 'missingUrls' && selectedIssue && (
        <QuickEditModal
          talk={selectedIssue}
          fields={[
            { name: 'tedUrl', label: 'TED URL', type: 'url', placeholder: 'https://www.ted.com/talks/...' },
            { name: 'youtubeUrl', label: 'YouTube URL', type: 'url', placeholder: 'https://www.youtube.com/watch?v=...' },
          ]}
          onClose={handleModalClose}
          onSuccess={handleFixSuccess}
        />
      )}

      {activeModal === 'shortDescription' && selectedIssue && (
        <QuickEditModal
          talk={selectedIssue}
          fields={[
            { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter a detailed description of the talk...' },
          ]}
          onClose={handleModalClose}
          onSuccess={handleFixSuccess}
        />
      )}

      {activeModal === 'missingThumbnail' && selectedIssue && (
        <FetchThumbnailModal
          talk={selectedIssue}
          onClose={handleModalClose}
          onSuccess={handleFixSuccess}
        />
      )}

      {activeModal === 'externalThumbnail' && selectedIssue && (
        <DownloadThumbnailModal
          talk={selectedIssue}
          onClose={handleModalClose}
          onSuccess={handleFixSuccess}
        />
      )}

      {activeModal === 'unmappedTalk' && selectedIssue && (
        <AddMappingModal
          talk={selectedIssue}
          onClose={handleModalClose}
          onSuccess={handleFixSuccess}
        />
      )}

      {activeModal === 'cardNoPrimary' && selectedIssue && (
        <SetPrimaryModal
          card={selectedIssue}
          mappings={[]}
          onClose={handleModalClose}
          onSuccess={handleFixSuccess}
        />
      )}
    </div>
  );
}
