import { useState } from 'react'
import { useCards, MAX_CARDS } from '../lib/useCards'
import CardItem from './CardItem'
import AddCardMenu from './AddCardMenu'

export default function CanvasBoard({
  canvasId,
  emptyLabel,
  readOnly = false,
  onSendToVrop
}) {
  const { cards, addCard, updateCard, updateCardLocal, removeCard } =
    useCards(canvasId)
  const [notice, setNotice] = useState('')

  async function handleAdd(type) {
    const { error } = await addCard(type)
    if (error) {
      setNotice(error.message)
      setTimeout(() => setNotice(''), 3000)
    }
  }

  return (
    <div className="board-wrapper">
      {notice && <div className="toast">{notice}</div>}

      <div className="canvas-board">
        {cards.length === 0 && (
          <p className="canvas-empty canvas-empty-board">
            {emptyLabel || 'Este lienzo está vacío.'}
          </p>
        )}

        {cards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            onUpdate={updateCard}
            onUpdateLocal={updateCardLocal}
            onRemove={removeCard}
            onSendToVrop={onSendToVrop}
          />
        ))}
      </div>

      {!readOnly && (
        <AddCardMenu onAdd={handleAdd} disabled={cards.length >= MAX_CARDS} />
      )}
    </div>
  )
}
