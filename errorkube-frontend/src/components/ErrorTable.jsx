import React from "react";
import { useNavigate } from "react-router-dom";
import { useTable } from "react-table";
import "./ErrorTable.css";

const ErrorTable = ({ data }) => {
  const navigate = useNavigate();
  const columns = React.useMemo(
    () => [
      {
        Header: "Time",
        accessor: "data.metadata.creationTimestamp",
        Cell: ({ value }) => new Date(value).toLocaleString(), // Format the timestamp
      },
      {
        Header: "Namespace",
        accessor: "data.metadata.namespace",
      },
      {
        Header: "Object",
        accessor: "data.metadata.name",
      },
      {
        Header: "Reason",
        accessor: "data.reason",
      },
      {
        Header: "Message",
        accessor: "data.message",
      },
    ],
    []
  );

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable({
    columns,
    data,
  });

  return (
    <div className="table-container">
      <table {...getTableProps()} className="error-table">
        <thead>
          {headerGroups.map((headerGroup) => (
            <tr {...headerGroup.getHeaderGroupProps()} className="table-header">
              {headerGroup.headers.map((column) => (
                <th {...column.getHeaderProps()} className="table-header-cell">
                  {column.render("Header")}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {rows.map((row) => {
            prepareRow(row);
            return (
              <tr
                {...row.getRowProps()}
                className="table-row"
                onClick={() =>
                  navigate(`/errorDetails`, {
                    state: { event: row.original }, // Pass only the matching event
                  })
                }
              >

                {row.cells.map((cell) => (
                  <td {...cell.getCellProps()} className="table-cell">
                    {cell.render("Cell")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ErrorTable;