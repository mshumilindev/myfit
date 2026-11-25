import { isCatalogProgram } from './model';

/**
 * A program's name. A catalog program (Train like a pro) is named "Athlete: Program": the athlete comes first and
 * is drawn in the accent colour, so it is clear whose program it is. Every other program is plain text.
 */
export function ProgramTitle({ program }: { program: { name: string } }) {
  const i = program.name.indexOf(': ');
  if (!isCatalogProgram(program) || i <= 0) return <>{program.name}</>;
  return (
    <>
      <span className="pg-who">{program.name.slice(0, i)}</span>
      {program.name.slice(i)}
    </>
  );
}
