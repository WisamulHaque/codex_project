export interface CommentReply {
  id: string;
  authorName: string;
  authorEmail: string;
  message: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  okrId: string;
  authorName: string;
  authorEmail: string;
  message: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
  replies: CommentReply[];
}
