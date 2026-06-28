import Link from "next/link";
import { PokemonCard, type PokemonCardData } from "./PokemonCard";

export interface CollectionPet extends PokemonCardData {
  id: string;
}

export function CollectionGrid({ pets }: { pets: CollectionPet[] }) {
  if (pets.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
        아직 포켓몬이 없어요.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {pets.map((pet) => (
        <Link key={pet.id} href={`/my-pokemon/${pet.id}`} className="block transition hover:-translate-y-0.5">
          <PokemonCard
            data={pet}
            footer={
              <p className="text-center text-xs font-medium text-slate-400">자세히 보기 →</p>
            }
          />
        </Link>
      ))}
    </div>
  );
}
