"""This documents aims to performs blast search and parse the results.
"""
import subprocess
import os
import pandas as pd
from Bio.Align import substitution_matrices

blosum62 = substitution_matrices.load("BLOSUM62")
BLASTP_PATH = "/Users/yizhouliu/mamba/envs/fastapi-react/bin/blastp"
PROTEIN_DB = "/Users/yizhouliu/Library/CloudStorage/OneDrive-Personal/工作/Shenzhen_biosys/Projects/CRISPRDB/crisprcasdb_codex/crisprdb/backend/test_data/test_blastp_db"



def validate_fasta_file(fasta_file:str) -> bool:
    """
    Validate the input FASTA file.
    
    Args:
        fasta_file (str): Path to the input FASTA file
        
    Returns:
        bool: True if the file is a valid FASTA file, False otherwise
    """
    if not os.path.isfile(fasta_file):
        return False
    with open(fasta_file, 'r') as f:
        first_line = f.readline().strip()
        if not first_line.startswith('>'):
            return False
    return True


class BLAST:
    def __init__(self,db_path:str):
        self.db_path = db_path

    def run_blast(self,query_file:str,e_value:float,max_target:int):
        """
        Run BLAST search.
        
        Args:
            query_file (str): Input FASTA sequence path
            e_value (float): E-value threshold
            max_hits (int): Maximum hits
            
        Returns:
            dict: Search results
        """
        outfmt = "10 qaccver saccver nident pident qlen length qcovhsp gaps gapopen " \
             "mismatch positive ppos qstart qend sstart send qframe sframe score " \
             "evalue bitscore qseq sseq"        
        fields = outfmt.split()[1:]

        blast_script = [BLASTP_PATH,"-query",f"{query_file}","-db",self.db_path,"-evalue",str(e_value),"-outfmt",f"{outfmt}","-max_target_seqs",f"{max_target}","-out",f"/tmp/{os.path.basename(query_file)}_blast_output.csv"]
        subprocess.run(blast_script, capture_output=False, check=True)
        
        output_file = f"/tmp/{os.path.basename(query_file)}_blast_output.csv"
        pd.read_csv(output_file, names=fields).to_csv(output_file,index=False)
        results = self.parse_blast_output(output_file)

        return results

    def parse_blast_output(self,output_file:str) -> dict:
        """
        Parse BLAST output file.
        
        Args:
            output_file (str): Path to BLAST output file
            
        Returns:
            dict: Parsed results
        """
        result_df = pd.read_csv(output_file)
        results = {}

        for query in result_df['qaccver'].unique():
            query_df = result_df[result_df['qaccver'] == query]
            results[query] = []
            for i,row in query_df.iterrows():
                single_hit_result = row.to_dict()
                #remove 'qaccver' key and change saccver to target_id
                single_hit_result['target_id'] = single_hit_result.pop('saccver')
                single_hit_result.pop('qaccver')
                results[query].append(single_hit_result)
        
        return results
    
    @staticmethod
    def parse_single_query_result_des(query,result:dict) -> str:
        """
        This function parse single blast query result
        Format of each query result: {query_id:{'target_id':xxx,'score':xxx...}}
        
        params:
            query: query id
            result: A blast result of a single hit of a certain query and target

        returns:
            text description of the blast result
        """

        single_query_result = f">{query} \n" \
                    f"\tScore = {round(result['bitscore'])} bits ({result['score']}), " \
                    f"E-value = {result['evalue']:.3g} \n" \
                    f"\tIdentities = {result['nident']}/{result['length']} ({result['pident']:.1f}%), " \
                    f"Query coverage = {result['length']}/{result['qlen']} ({result['qcovhsp']:.1f}%), " \
                    f"Gap opens = {result['gapopen']}\n" \
                    f"\tPositives = {result['positive']}/{result['length']} ({result['ppos']:.1f}%), " \
                    f"Mismatches = {result['mismatch']}/{result['length']} ({result['mismatch']/(result['length']-result['gaps'])*100:.1f}%), " \
                    f"Gaps = {result['gaps']}/{result['length']} ({result['gaps']/result['length']*100:.1f}%)\n" \
                    f"\tFrame = {result['sframe']}\n\n"

        return single_query_result

    @staticmethod
    def parse_single_query_alignment(query: str, result: dict) -> str:
        """
        Format BLAST sequence alignment in standard BLAST output style.
        
        Args:
            query: Query sequence ID
            result: BLAST result dict containing qseq, sseq, qstart, sstart
        
        Returns:
            Formatted alignment string showing Query, Match line, and Subject
        """
        def _generate_match_line(qseq: str, sseq: str) -> str:
            """
            Generate match line showing alignment quality.
            
            Symbols:
                Uppercase letter = Exact match (identical amino acids)
                Lowercase letter = Positive match (similar amino acids)
                Space = Mismatch or gap
            
            Args:
                qseq: Query sequence with possible gaps (-)
                sseq: Subject sequence with possible gaps (-)
            
            Returns:
                Match line string
            """
            match_line = []
            
            for q, s in zip(qseq, sseq):
                if q == '-' or s == '-':
                    match_line.append(' ')  # Gap
                elif q == s:
                    match_line.append(q.upper())  # Exact match
                else:
                    # Check similarity using BLOSUM62 matrix
                    try:
                        score = blosum62.get((q.upper(), s.upper())) or \
                                blosum62.get((s.upper(), q.upper()), -100)
                        if score > 0:
                            match_line.append("+")  # Positive match
                        else:
                            match_line.append(' ')  # Mismatch
                    except:
                        match_line.append(' ')
            
            return ''.join(match_line)
            

        # Check if sequences are available
        if 'qseq' not in result or 'sseq' not in result:
            return "(Sequence alignment not available)\n"
        
        qseq = result['qseq']
        sseq = result['sseq']
        qstart = result['qstart']
        sstart = result['sstart']
        # Generate match line showing alignment quality
        match_line = _generate_match_line(qseq, sseq)

        
        alignment = ""
        line_length = 60  # Standard BLAST line length
        
        # Display alignment in 60-character blocks
        for i in range(0, len(qseq), line_length):
            q_segment = qseq[i:i+line_length]
            m_segment = match_line[i:i+line_length]
            s_segment = sseq[i:i+line_length]
            
            # Calculate current positions (excluding gaps)
            q_pos = qstart + len(qseq[:i].replace('-', ''))
            s_pos = sstart + len(sseq[:i].replace('-', ''))
            q_end = q_pos + len(q_segment.replace('-', '')) - 1
            s_end = s_pos + len(s_segment.replace('-', '')) - 1
            
            # Format three lines: Query, Match, Subject
            alignment += f"Query  {q_pos:<7d} {q_segment} {q_end}\n"
            alignment += f"{'':15}{m_segment}\n"
            alignment += f"Sbjct  {s_pos:<7d} {s_segment} {s_end}\n\n"
        
        return alignment

    @staticmethod
    def parse_blast_results_into_df(results:dict) -> pd.DataFrame:
        """
        Convert BLAST results into a pandas DataFrame for display.
        
        Args:
            results (dict): BLAST search results
            
        Returns:
            pd.DataFrame: DataFrame containing BLAST results
        """
        all_blast_results_lst = []
        COLUMN_MAPPING = {
            'query_id': 'query_id',           # Query sequence ID
            'target_id': 'target_id',         # Target/Subject sequence ID
            'nident': 'num_identical',        # Number of identical matches
            'pident': 'percent_identity',     # Percentage of identical matches
            'qlen': 'query_length',           # Query sequence length
            'length': 'alignment_length',     # Alignment length
            'qcovhsp': 'query_coverage',      # Query coverage per HSP
            'gaps': 'num_gaps',               # Total number of gaps
            'gapopen': 'num_gap_openings',    # Number of gap openings
            'mismatch': 'num_mismatches',     # Number of mismatches
            'positive': 'num_positives',      # Number of positive-scoring matches
            'ppos': 'percent_positive',       # Percentage of positive-scoring matches
            'qstart': 'query_start',           # Start position in query
            'qend': 'query_end',               # End position in query
            'sstart': 'subject_start',         # Start position in subject
            'send': 'subject_end',             # End position in subject
            'qframe': 'query_frame',           # Query frame
            'sframe': 'subject_frame',         # Subject frame
            'score': 'alignment_score',       # Raw alignment score
            'evalue': 'e_value',              # Expect value
            'bitscore': 'bit_score',           # Bit score
            'qseq': 'query_sequence',         # Aligned query sequence
            'sseq': 'subject_sequence'        # Aligned subject sequence
        }

        for query, query_results in results.items():
            single_blast_result_df = pd.DataFrame(query_results)
            single_blast_result_df['query_id'] = query
            #rename columns based on COLUMN_MAPPING
            single_blast_result_df = single_blast_result_df.rename(columns=COLUMN_MAPPING)
            #reorder columns
            cols = ['query_id', 'target_id'] + [col for col in single_blast_result_df.columns 
                                      if col not in ['query_id', 'target_id']]
            single_blast_result_df = single_blast_result_df[cols]
            all_blast_results_lst.append(single_blast_result_df)
        
        all_blast_results_df = pd.DataFrame(all_blast_results_lst)
        
        return all_blast_results_df

def run_blastp(fasta_file:str,
               e_value:float,
               max_target:int,
               db_path:str) -> dict:
    """
    Run BLASTP search for a given FASTA file against a specified database.
    
    Args:
        fasta_file (str): Path to the input FASTA file
        e_value (float): E-value threshold for filtering results
        max_target (int): Maximum number of target sequences to return
        db_path (str): Path to the BLAST database
    
    Returns:
        dict: BLAST search results
    """
    pass
