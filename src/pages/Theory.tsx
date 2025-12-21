import { BookOpen, Layers, List } from 'lucide-react';

export default function Theory() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Hero Section */}
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          CLR(1) Parsing
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)' }}>
          Canonical LR(1) parsing is a powerful bottom-up parsing technique 
          that uses lookahead symbols to resolve conflicts.
        </p>
      </header>

      {/* Definition Card */}
      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <SectionHeader icon={<BookOpen size={18} />} title="Definition" />
        <p style={{ marginBottom: '1rem' }}>
          CLR(1) stands for <strong>Canonical Left-to-right Rightmost derivation (1 lookahead)</strong>. 
          It constructs a state machine (parsing table) where each state represents a set of items 
          valid for that point in the parse.
        </p>
        <p style={{ color: 'var(--text-secondary)' }}>
          Unlike LR(0) or SLR, CLR(1) items include a lookahead symbol, which makes the parser 
          more powerful (more states, fewer conflicts) but also larger in size.
        </p>
      </section>

      {/* Key Concepts */}
      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <SectionHeader icon={<Layers size={18} />} title="Key Concepts" />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Concept 
            number={1} 
            title="Augmented Grammar"
            description={<>
              We add a new start symbol <code>S'</code> and production <code>S' → S</code>. 
              This provides a unique acceptance state for the parser.
            </>}
          />
          
          <Concept 
            number={2} 
            title="LR(1) Item"
            description={<>
              An item is of the form <code>[A → α . β, a]</code>, where:
              <ul style={{ marginTop: '0.5rem', marginLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                <li><code>A → αβ</code> is a production</li>
                <li>The dot <code>.</code> shows parsing progress</li>
                <li><code>a</code> is the lookahead terminal (or $)</li>
              </ul>
            </>}
          />
          
          <Concept 
            number={3} 
            title="Closure Operation"
            description={<>
              If <code>[A → α . B β, a]</code> is in a state, we expand by adding all 
              productions for <code>B</code>. The lookahead for new items is derived 
              from <code>FIRST(βa)</code>.
            </>}
          />
          
          <Concept 
            number={4} 
            title="Goto Operation"
            description={<>
              Moving the dot over a symbol. <code>Goto(I, X)</code> creates a new state 
              from items in <code>I</code> where the dot is before <code>X</code>.
            </>}
          />
        </div>
      </section>

      {/* Algorithm Steps */}
      <section className="card">
        <SectionHeader icon={<List size={18} />} title="Algorithm Steps" />
        
        <ol style={{ 
          listStyle: 'none', 
          padding: 0, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.75rem' 
        }}>
          <Step number={1} text="Construct the Augmented Grammar" />
          <Step number={2} text="Compute FIRST sets for all symbols" />
          <Step number={3} text={<>Create the initial item set <code>closure([S' → . S, $])</code></>} />
          <Step number={4} text="Repeatedly apply Goto operations to find all canonical states" />
          <Step number={5} text={<>
            Construct the ACTION and GOTO tables:
            <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <li>Transitions on terminals → Shift</li>
              <li>Items with dot at end → Reduce (only if lookahead matches)</li>
              <li>Transitions on non-terminals → Goto state update</li>
            </ul>
          </>} />
        </ol>
      </section>
    </div>
  );
}

// Helper Components
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '0.5rem',
      fontSize: '1.125rem', 
      fontWeight: 600,
      marginBottom: '1rem',
      paddingBottom: '0.75rem',
      borderBottom: '1px solid var(--border)'
    }}>
      <span style={{ color: 'var(--accent)' }}>{icon}</span>
      {title}
    </h2>
  );
}

function Concept({ number, title, description }: { 
  number: number; 
  title: string; 
  description: React.ReactNode;
}) {
  return (
    <div>
      <h3 style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem',
        fontWeight: 600,
        color: 'var(--accent)',
        marginBottom: '0.5rem'
      }}>
        <span style={{ 
          width: '20px', 
          height: '20px', 
          background: 'var(--accent-subtle)', 
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem'
        }}>
          {number}
        </span>
        {title}
      </h3>
      <p style={{ lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

function Step({ number, text }: { number: number; text: React.ReactNode }) {
  return (
    <li style={{ 
      display: 'flex', 
      gap: '0.75rem',
      alignItems: 'flex-start'
    }}>
      <span style={{ 
        minWidth: '24px', 
        height: '24px', 
        background: 'var(--accent)',
        color: 'white',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: 600
      }}>
        {number}
      </span>
      <span style={{ paddingTop: '2px' }}>{text}</span>
    </li>
  );
}
