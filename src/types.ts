export interface ODModelBase {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

// TODO make less generic
export interface ODFilter {
  [key: string]: any;
}
