/**
 * Payload adapters around the pure rules in ./rules.ts and ./roles.ts.
 */
import type { Access, FieldAccess } from 'payload'

import { isAdmin, isEditorOrAdmin, isStaff, type MaybeUser } from './roles'
import {
  canReadInternal,
  canReadUserPrivateField,
  canSetEditorialFlags,
  createArticle,
  deleteArticle,
  readPublishedOrStaff,
  updateArticle,
  updateMedia,
  updateUser,
} from './rules'

export * from './roles'
export * from './rules'

const u = (user: unknown): MaybeUser => user as MaybeUser

export const anyone: Access = () => true
export const nobody: Access = () => false
export const staffOnly: Access = ({ req }) => isStaff(u(req.user))
export const editorsOnly: Access = ({ req }) => isEditorOrAdmin(u(req.user))
export const adminsOnly: Access = ({ req }) => isAdmin(u(req.user))

export const publishedOrStaff: Access = ({ req }) => readPublishedOrStaff(u(req.user))
export const articleCreate: Access = ({ req }) => createArticle(u(req.user))
export const articleUpdate: Access = ({ req }) => updateArticle(u(req.user))
export const articleDelete: Access = ({ req }) => deleteArticle(u(req.user))
export const mediaUpdate: Access = ({ req }) => updateMedia(u(req.user))
export const userUpdate: Access = ({ req }) => updateUser(u(req.user))

export const editorialFlagField: FieldAccess = ({ req }) => canSetEditorialFlags(u(req.user))
export const internalField: FieldAccess = ({ req }) => canReadInternal(u(req.user))
export const adminField: FieldAccess = ({ req }) => isAdmin(u(req.user))
export const noUpdateField: FieldAccess = () => false
export const userPrivateField: FieldAccess = ({ req, id, doc }) =>
  canReadUserPrivateField(u(req.user), id ?? (doc as { id?: unknown } | undefined)?.id)
