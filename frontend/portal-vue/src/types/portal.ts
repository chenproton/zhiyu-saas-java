// 门户学习社区类型（移植自原 React 版 shared-types 的 portal.ts）

export interface CommunityTopic {
  id: string;
  tenantId: string;
  authorId: string;
  authorName: string;
  avatarUrl?: string;
  title: string;
  content: string;
  tag?: string;
  replyCount: number;
  viewCount: number;
  lastReplyAt?: string;
  createdAt: string;
  isMine: boolean;
}

export interface CommunityReply {
  id: string;
  topicId: string;
  authorId: string;
  authorName: string;
  avatarUrl?: string;
  parentId?: string;
  parentAuthorId?: string;
  parentAuthorName?: string;
  content: string;
  createdAt: string;
  isMine: boolean;
}

export type CommunityTopicSort = 'hot' | 'latest' | 'mine';
