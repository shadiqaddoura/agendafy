import { NextResponse } from 'next/server'
import { db, groupsCol, todosCol } from '@/lib/firestore'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { name } = await req.json()
  await groupsCol().doc(id).update({ name })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Unassign todos that belong to this group
  const todosSnap = await todosCol().where('groupId', '==', id).get()
  const batch = db.batch()
  todosSnap.docs.forEach((doc) => batch.update(doc.ref, { groupId: null }))
  batch.delete(groupsCol().doc(id))
  await batch.commit()

  return NextResponse.json({ ok: true })
}
