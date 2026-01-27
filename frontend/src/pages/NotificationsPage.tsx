import { useEffect, useState } from "react"
import api from "../lib/api"

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    api.get("/api/notifications").then(res => {
      setNotifications(res.data)
    })
  }, [])

  return (
    <div>
      <h2>Notifications</h2>

      {notifications.length === 0 && <p>No notifications</p>}

      {notifications.map(n => (
        <div key={n.id}>
          <p>{n.message}</p>
        </div>
      ))}
    </div>
  )
}
