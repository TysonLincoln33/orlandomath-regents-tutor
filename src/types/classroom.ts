export type Classroom = {
  id: string;
  teacher_id: string;
  name: string;
  subject: string | null;
  term: string | null;
  class_code: string;
  created_at: string;
  updated_at: string;
};

export type ClassroomMember = {
  id: string;
  classroom_id: string;
  user_id: string;
  joined_via: string;
  joined_at: string;
};

export type CreateClassroomInput = {
  name: string;
  subject?: string;
  term?: string;
};

export type JoinClassroomByCodeInput = {
  classCode: string;
};