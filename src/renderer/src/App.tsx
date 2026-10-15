import { useApp } from './lib/store'
import { Welcome } from './screens/Welcome'
import { Shell } from './screens/Shell'
import { Feather } from './components/Logo'

export function App(): JSX.Element {
  const { booted, user } = useApp()
  if (!booted) {
    return (
      <div className="drag flex h-full items-center justify-center text-fg-3">
        <Feather size={28} />
      </div>
    )
  }
  return user ? <Shell /> : <Welcome />
}
