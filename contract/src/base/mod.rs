//! Shared contract implementation building blocks.

/// Authorization and validation helpers.
pub mod auth;
/// Contract error codes.
pub mod errors;
/// Contract event publishers.
pub mod events;
/// Persistent data and storage-key types.
pub mod types;
/// Basis-point calculation and distribution helpers.
pub mod utils;
/// Backward-compatible re-export of [`auth`] for existing validators call-sites.
pub mod validators;
