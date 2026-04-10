export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      connected_accounts: {
        Row: {
          id: string;
          user_id: string;
          provider: "github";
          provider_user_id: string;
          login: string;
          access_token_encrypted: string;
          token_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: "github";
          provider_user_id: string;
          login: string;
          access_token_encrypted: string;
          token_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          provider_user_id?: string;
          login?: string;
          access_token_encrypted?: string;
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      repositories: {
        Row: {
          id: string;
          user_id: string;
          provider: "github";
          provider_repo_id: number;
          owner_login: string;
          name: string;
          full_name: string;
          default_branch: string;
          is_private: boolean;
          provider_updated_at: string | null;
          provider_pushed_at: string | null;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: "github";
          provider_repo_id: number;
          owner_login: string;
          name: string;
          full_name: string;
          default_branch: string;
          is_private: boolean;
          provider_updated_at?: string | null;
          provider_pushed_at?: string | null;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          owner_login?: string;
          name?: string;
          full_name?: string;
          default_branch?: string;
          is_private?: boolean;
          provider_updated_at?: string | null;
          provider_pushed_at?: string | null;
          last_seen_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      analysis_runs: {
        Row: {
          id: string;
          user_id: string;
          repository_id: string;
          status: "queued" | "processing" | "completed" | "failed" | "dead_letter";
          requested_at: string;
          started_at: string | null;
          finished_at: string | null;
          current_stage: string;
          progress_phase: string;
          progress_pct: number;
          error_message: string | null;
          attempt_count: number;
          max_attempts: number;
          leased_at: string | null;
          lease_expires_at: string | null;
          worker_id: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          processed_commit_count: number;
          selected_commit_count: number;
          commit_window_start: string;
          commit_window_end: string;
          commit_limit: number;
          snapshot_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          repository_id: string;
          status?: "queued" | "processing" | "completed" | "failed" | "dead_letter";
          requested_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
          current_stage?: string;
          progress_phase?: string;
          progress_pct?: number;
          error_message?: string | null;
          attempt_count?: number;
          max_attempts?: number;
          leased_at?: string | null;
          lease_expires_at?: string | null;
          worker_id?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          processed_commit_count?: number;
          selected_commit_count?: number;
          commit_window_start: string;
          commit_window_end: string;
          commit_limit: number;
          snapshot_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "queued" | "processing" | "completed" | "failed" | "dead_letter";
          started_at?: string | null;
          finished_at?: string | null;
          current_stage?: string;
          progress_phase?: string;
          progress_pct?: number;
          error_message?: string | null;
          attempt_count?: number;
          max_attempts?: number;
          leased_at?: string | null;
          lease_expires_at?: string | null;
          worker_id?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          processed_commit_count?: number;
          selected_commit_count?: number;
          commit_window_start?: string;
          commit_window_end?: string;
          commit_limit?: number;
          snapshot_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      analysis_snapshots: {
        Row: {
          id: string;
          user_id: string;
          repository_id: string;
          analysis_run_id: string;
          generated_at: string;
          analysis_mode: "full" | "reduced" | "degraded";
          commit_count_processed: number;
          tree_file_count: number;
          degraded_reason: string | null;
          high_risk_modules: number;
          healthy_modules: number;
          leading_owner_coverage: number;
          node_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          repository_id: string;
          analysis_run_id: string;
          generated_at?: string;
          analysis_mode?: "full" | "reduced" | "degraded";
          commit_count_processed?: number;
          tree_file_count?: number;
          degraded_reason?: string | null;
          high_risk_modules: number;
          healthy_modules: number;
          leading_owner_coverage: number;
          node_count: number;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      repository_processing_locks: {
        Row: {
          repository_id: string;
          run_id: string;
          lease_expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          repository_id: string;
          run_id: string;
          lease_expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          run_id?: string;
          lease_expires_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      analysis_job_claims: {
        Row: {
          msg_id: number;
          run_id: string;
          stage: string;
          claimed_at: string;
        };
        Insert: {
          msg_id: number;
          run_id: string;
          stage: string;
          claimed_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      analysis_run_tree_files: {
        Row: {
          id: string;
          run_id: string;
          path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          path: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      analysis_run_commits: {
        Row: {
          id: string;
          run_id: string;
          commit_sha: string;
          commit_sequence: number;
          committed_at: string;
          batch_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          commit_sha: string;
          commit_sequence: number;
          committed_at: string;
          batch_index: number;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      analysis_run_commit_files: {
        Row: {
          id: string;
          run_id: string;
          commit_sha: string;
          commit_sequence: number;
          committed_at: string;
          owner_key: string;
          owner_login: string | null;
          display_name: string;
          filename: string;
          additions: number;
          deletions: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          commit_sha: string;
          commit_sequence: number;
          committed_at: string;
          owner_key: string;
          owner_login?: string | null;
          display_name: string;
          filename: string;
          additions: number;
          deletions: number;
          status: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      analysis_run_stage_state: {
        Row: {
          run_id: string;
          next_batch_index: number;
          batch_size: number;
          tree_file_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          run_id: string;
          next_batch_index?: number;
          batch_size?: number;
          tree_file_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          next_batch_index?: number;
          batch_size?: number;
          tree_file_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      analysis_nodes: {
        Row: {
          id: string;
          snapshot_id: string;
          path: string;
          label: string;
          node_type: "file" | "folder";
          depth: number;
          parent_path: string | null;
          leading_owner_id: string | null;
          leading_owner_share: number;
          bus_factor: number;
          risk_level: "critical" | "warning" | "healthy";
          raw_score_total: number;
          file_count: number;
          owner_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_id: string;
          path: string;
          label: string;
          node_type: "file" | "folder";
          depth: number;
          parent_path?: string | null;
          leading_owner_id?: string | null;
          leading_owner_share: number;
          bus_factor: number;
          risk_level: "critical" | "warning" | "healthy";
          raw_score_total: number;
          file_count: number;
          owner_count: number;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      analysis_node_owners: {
        Row: {
          id: string;
          snapshot_id: string;
          node_path: string;
          owner_key: string;
          owner_login: string | null;
          display_name: string;
          normalized_score: number;
          raw_score: number;
          rank: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_id: string;
          node_path: string;
          owner_key: string;
          owner_login?: string | null;
          display_name: string;
          normalized_score: number;
          raw_score: number;
          rank: number;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      analysis_graph_edges: {
        Row: {
          id: string;
          snapshot_id: string;
          source_path: string;
          target_path: string;
          edge_type: "parent";
          label: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_id: string;
          source_path: string;
          target_path: string;
          edge_type?: "parent";
          label?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      acquire_repository_run_lock: {
        Args: {
          target_repository_id: string;
          target_run_id: string;
          lease_seconds: number;
        };
        Returns: boolean;
      };
      renew_repository_run_lock: {
        Args: {
          target_repository_id: string;
          target_run_id: string;
          lease_seconds: number;
        };
        Returns: boolean;
      };
      release_repository_run_lock: {
        Args: {
          target_repository_id: string;
          target_run_id: string;
        };
        Returns: boolean;
      };
      enqueue_ownership_analysis_job: {
        Args: {
          payload: Json;
          delay_seconds?: number;
        };
        Returns: number;
      };
      read_ownership_analysis_jobs: {
        Args: {
          vt_seconds: number;
          qty?: number;
          max_poll_seconds?: number;
        };
        Returns: {
          msg_id: number;
          read_ct: number;
          enqueued_at: string;
          vt: string;
          message: Json;
        }[];
      };
      delete_ownership_analysis_job: {
        Args: {
          target_msg_id: number;
        };
        Returns: boolean;
      };
      archive_ownership_analysis_job: {
        Args: {
          target_msg_id: number;
        };
        Returns: boolean;
      };
      extend_ownership_analysis_job_visibility: {
        Args: {
          target_msg_id: number;
          vt_seconds: number;
        };
        Returns: {
          msg_id: number;
          vt: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
