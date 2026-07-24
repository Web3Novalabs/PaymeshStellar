export interface GroupMember {
  address: string;
  name: string;
  percentage: number;
}

export interface Group {
  id: string;
  groupId: string;
  name: string;
  creator: string;
  paymentToken: string;
  members: GroupMember[];
  membersCount: number;
  createdAt: Date;
}

export interface GroupsService {
  create(groupData: Omit<Group, 'id' | 'createdAt' | 'membersCount'>): Promise<Group>;
  getById(id: string): Promise<Group | null>;
  getByGroupId(groupId: string): Promise<Group | null>;
  list(options: {
    limit?: number;
    offset?: number;
    creator?: string;
  }): Promise<{ groups: Group[]; totalCount: number }>;
  update(id: string, groupData: Partial<Omit<Group, 'id' | 'createdAt'>>): Promise<Group | null>;
  clear(): Promise<void>;
}
