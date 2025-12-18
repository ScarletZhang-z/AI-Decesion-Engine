type ConfigureHeaderProps = {
  onCreate: () => void;
};

export function ConfigureHeader({ onCreate }: ConfigureHeaderProps) {
  return (
    <div className="configure-header">
      <div>
        <h1>Rules</h1>
        <p>
          Define routing rules based on contract type, location, and department.
        </p>
      </div>
      <button className="button" type="button" onClick={onCreate}>
        New Rule
      </button>
    </div>
  );
}
